import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { MoodleService } from 'src/moodle/moodle.service';
import {
  DEFAULT_AVATAR_COLOR,
  UserProfilePrefs,
} from './user-profile-prefs.entity';

export interface UserProfile {
  id: number;
  moodleUserId: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  avatar: string | null;
  avatarColor: string;
  level: string;
}

interface MoodleUploadResult {
  itemid?: number;
}

interface MoodleUpdatePictureResult {
  success?: boolean;
  profileimageurl?: string;
  warnings?: unknown[];
}

@Injectable()
export class UsersService {
  constructor(
    private readonly moodleService: MoodleService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(UserProfilePrefs)
    private readonly prefsRepo: Repository<UserProfilePrefs>,
  ) {}

  /** Moodle default icons are not real uploads — treat as no photo. */
  private normalizeAvatar(url: string | null | undefined): string | null {
    if (!url || typeof url !== 'string') return null;
    const lower = url.toLowerCase();
    if (
      lower.includes('/u/f1') ||
      lower.includes('/u/f2') ||
      (lower.includes('theme/image.php') && lower.includes('/u/'))
    ) {
      return null;
    }
    return url;
  }

  private async getAvatarColor(moodleUserId: number): Promise<string> {
    const prefs = await this.prefsRepo.findOne({ where: { moodleUserId } });
    return prefs?.avatarColor || DEFAULT_AVATAR_COLOR;
  }

  private mapUser(
    usuarioRaw: Record<string, unknown>,
    avatarColor: string = DEFAULT_AVATAR_COLOR,
  ): UserProfile {
    const firstname = (usuarioRaw.firstname as string) || '';
    const lastname = (usuarioRaw.lastname as string) || '';
    const avatar = this.normalizeAvatar(
      (usuarioRaw.profileimageurl as string) ||
        (usuarioRaw.profileimageurlsmall as string) ||
        null,
    );

    return {
      id: usuarioRaw.id as number,
      moodleUserId: usuarioRaw.id as number,
      username: usuarioRaw.username as string,
      firstname,
      lastname,
      fullname: `${firstname} ${lastname}`.trim(),
      email: (usuarioRaw.email as string) || '',
      avatar,
      avatarColor,
      level: (usuarioRaw.department as string) || 'Unassigned',
    };
  }

  private async findByField(field: 'email' | 'username' | 'id', value: string) {
    const data = await this.moodleService.request<
      { users?: Record<string, unknown>[] } | Record<string, unknown>[]
    >('core_user_get_users_by_field', {
      field,
      'values[0]': value,
    });

    const users = Array.isArray(data)
      ? data
      : Array.isArray(data?.users)
        ? data.users
        : [];

    if (users.length === 0) {
      throw new NotFoundException(`User not found for ${field}: ${value}`);
    }

    const raw = users[0] as Record<string, unknown>;
    const id = raw.id as number;
    const avatarColor = await this.getAvatarColor(id);
    return this.mapUser(raw, avatarColor);
  }

  async findOneByEmail(email: string) {
    return this.findByField('email', email);
  }

  async findOneByUsername(username: string) {
    return this.findByField('username', username);
  }

  /** Autocomplete admin: búsqueda parcial en Moodle. */
  async searchUsers(query: string) {
    const q = query.trim();
    if (q.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    const users = await this.moodleService.searchUsers(q, 25);
    return users.map((u) => ({
      moodleUserId: u.id,
      fullname: u.fullname,
      email: u.email,
      username: u.username,
    }));
  }

  async getMe(userToken: string): Promise<UserProfile> {
    const userId = await this.moodleService.getUserIdFromToken(userToken);
    return this.findByField('id', String(userId));
  }

  async updateProfile(
    userToken: string,
    firstname: string,
    lastname: string,
  ): Promise<UserProfile> {
    const first = firstname.trim();
    const last = lastname.trim();
    if (!first || !last) {
      throw new BadRequestException('First name and last name are required');
    }

    const me = await this.getMe(userToken);
    await this.moodleService.request('core_user_update_users', {
      'users[0][id]': me.id,
      'users[0][firstname]': first,
      'users[0][lastname]': last,
    });

    return this.getMe(userToken);
  }

  async updatePrefs(userToken: string, avatarColor: string): Promise<UserProfile> {
    const me = await this.getMe(userToken);
    await this.prefsRepo.save({
      moodleUserId: me.id,
      avatarColor: avatarColor.toUpperCase(),
    });
    return { ...me, avatarColor: avatarColor.toUpperCase() };
  }

  /** Verifies username+password against Moodle login/token.php. */
  private async verifyMoodlePassword(username: string, password: string): Promise<void> {
    const baseUrl = this.configService.get<string>('MOODLE_URL') || '';
    if (!baseUrl) {
      throw new BadGatewayException('MOODLE_URL is not configured');
    }

    const service = this.configService.get<string>('MOODLE_SERVICE') || 'hopee';
    const origin = baseUrl.split('/webservice')[0];

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<{ token?: string; error?: string; errorcode?: string }>(
          `${origin}/login/token.php`,
          new URLSearchParams({ username, password, service }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      if (data?.error || !data?.token) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException || error instanceof BadGatewayException) {
        throw error;
      }
      const axiosError = error as AxiosError;
      if (
        axiosError?.code === 'ECONNREFUSED' ||
        axiosError?.code === 'ENOTFOUND' ||
        axiosError?.code === 'ETIMEDOUT'
      ) {
        throw new BadGatewayException('Could not reach Moodle to verify password');
      }
      throw new UnauthorizedException('Current password is incorrect');
    }
  }

  async changePassword(
    userToken: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const me = await this.getMe(userToken);
    await this.verifyMoodlePassword(me.username, currentPassword);

    await this.moodleService.request('core_user_update_users', {
      'users[0][id]': me.id,
      'users[0][password]': newPassword,
    });

    return { message: 'Password updated successfully' };
  }

  async updateAvatar(
    userToken: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<{ avatar: string | null; message: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, GIF, or WebP images are allowed');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Image must be 2 MB or smaller');
    }

    const me = await this.getMe(userToken);
    const safeName = (file.originalname || 'avatar.jpg').replace(/[^\w.\-]+/g, '_');
    const filecontent = file.buffer.toString('base64');

    const uploadData = await this.moodleService.requestPostForm<MoodleUploadResult>(
      'core_files_upload',
      {
        component: 'user',
        filearea: 'draft',
        itemid: '0',
        filepath: '/',
        filename: safeName,
        filecontent,
        contextlevel: 'user',
        instanceid: String(me.id),
      },
      userToken,
    );

    const draftitemid = uploadData?.itemid;
    if (!draftitemid) {
      throw new BadGatewayException('Moodle did not return a draft file id for the upload');
    }

    const picture = await this.moodleService.requestPostForm<MoodleUpdatePictureResult>(
      'core_user_update_picture',
      {
        draftitemid: String(draftitemid),
        userid: String(me.id),
      },
      userToken,
    );

    if (picture && picture.success === false) {
      throw new BadGatewayException('Moodle could not update the profile picture');
    }

    const refreshed = await this.getMe(userToken);
    return {
      avatar: this.normalizeAvatar(picture?.profileimageurl) || refreshed.avatar,
      message: 'Profile photo updated',
    };
  }

  async deleteAvatar(userToken: string): Promise<{ avatar: null; message: string }> {
    const me = await this.getMe(userToken);
    const picture = await this.moodleService.requestPostForm<MoodleUpdatePictureResult>(
      'core_user_update_picture',
      {
        draftitemid: '0',
        delete: '1',
        userid: String(me.id),
      },
      userToken,
    );

    if (picture && picture.success === false) {
      throw new BadGatewayException('Moodle could not remove the profile picture');
    }

    return { avatar: null, message: 'Profile photo removed' };
  }
}
