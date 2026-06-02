import { Injectable, NotFoundException } from '@nestjs/common';
import { MoodleService } from 'src/moodle/moodle.service';

@Injectable()
export class UsersService {
  constructor(private readonly moodleService: MoodleService) {}

  private mapUser(usuarioRaw: Record<string, unknown>) {
    return {
      id: usuarioRaw.id as number,
      moodleUserId: usuarioRaw.id as number,
      username: usuarioRaw.username as string,
      firstname: usuarioRaw.firstname as string,
      lastname: usuarioRaw.lastname as string,
      fullname: `${usuarioRaw.firstname} ${usuarioRaw.lastname}`,
      email: usuarioRaw.email as string,
      avatar: usuarioRaw.profileimageurlsmall as string,
      level: (usuarioRaw.department as string) || 'No asignado',
    };
  }

  private async findByField(field: 'email' | 'username', value: string) {
    const data = await this.moodleService.request('core_user_get_users_by_field', {
      field,
      'values[0]': value,
    });

    const users = data?.users ?? data ?? [];
    if (!Array.isArray(users) || users.length === 0) {
      throw new NotFoundException(`No se encontró usuario con ${field}: ${value}`);
    }
    return this.mapUser(users[0] as Record<string, unknown>);
  }

  async findOneByEmail(email: string) {
    return this.findByField('email', email);
  }

  async findOneByUsername(username: string) {
    return this.findByField('username', username);
  }
}