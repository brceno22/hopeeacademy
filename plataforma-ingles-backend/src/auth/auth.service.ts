import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import type { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { MoodleService } from '../moodle/moodle.service';
import { MoodleSiteInfo } from '../moodle/moodle.types';

export interface LoginResponse {
  message: string;
  moodleToken: string;
  userId: number;
  fullName: string;
}

export interface AuthCapabilities {
  isTeacher: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly moodleService: MoodleService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async login(usernameOrEmail: string, password: string): Promise<LoginResponse> {
    const baseUrl = this.configService.get<string>('MOODLE_URL') || '';
    if (!baseUrl) {
      throw new BadGatewayException('MOODLE_URL no está configurada');
    }

    const service = this.configService.get<string>('MOODLE_SERVICE') || 'hopee';
    const urlLimpia = baseUrl.split('/webservice')[0];
    const urlFinal = `${urlLimpia}/login/token.php`;

    // Moodle token.php solo acepta username (no email). Resolvemos email → username.
    const username = await this.resolveMoodleUsername(usernameOrEmail.trim());

    try {
      const params = new URLSearchParams({
        username,
        password,
        service,
      });

      const { data } = await firstValueFrom(
        this.httpService.get<{ token?: string; error?: string; errorcode?: string }>(
          `${urlFinal}?${params.toString()}`,
        ),
      );

      if (data?.errorcode === 'enablewsdescription' || data?.error?.includes('Web services')) {
        this.logger.error('Moodle web services are disabled');
        throw new BadGatewayException(
          'Los Web Services de Moodle aún están habilitados. Activá Site administration → Advanced features → Enable web services.',
        );
      }

      if (data?.errorcode === 'servicenotavailable' || data?.errorcode === 'servicenotexist') {
        throw new BadGatewayException(
          `El servicio Moodle "${service}" no existe o no está habilitado. Crealo/habilitalo en External services.`,
        );
      }

      if (
        data?.errorcode === 'cannotcreatetoken' ||
        data?.errorcode === 'missingrequiredcapability'
      ) {
        throw new UnauthorizedException(
          data?.error ||
            `Falta el permiso moodle/webservice:createtoken para el servicio "${service}".`,
        );
      }

      if (data?.error || !data?.token) {
        const detail = data?.errorcode ? ` (${data.errorcode})` : '';
        this.logger.warn(
          `Moodle login error for "${usernameOrEmail}" → "${username}": ${data?.error || 'no token'}${detail}`,
        );
        throw new UnauthorizedException(
          data?.errorcode === 'invalidlogin'
            ? 'Usuario o contraseña incorrectos. Usá el username de Moodle (ej. estudiante1) y la misma clave que en Moodle.'
            : data?.error || 'No se pudo iniciar sesión en Moodle',
        );
      }

      const infoParams = new URLSearchParams({
        wstoken: data.token,
        wsfunction: 'core_webservice_get_site_info',
        moodlewsrestformat: 'json',
      });

      const { data: siteInfo } = await firstValueFrom(
        this.httpService.get<MoodleSiteInfo>(`${baseUrl}?${infoParams.toString()}`),
      );

      if (!siteInfo?.userid) {
        throw new UnauthorizedException('No se pudo obtener la información del usuario');
      }

      return {
        message: 'Login exitoso',
        moodleToken: data.token,
        userId: siteInfo.userid,
        fullName: siteInfo.fullname,
      };
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
        this.logger.error(`Moodle login unreachable: ${axiosError.code}`);
        throw new BadGatewayException(
          'No se pudo conectar con Moodle. Verificá que el servicio esté disponible.',
        );
      }

      this.logger.warn(`Login failed for user "${usernameOrEmail}"`);
      throw new UnauthorizedException('No se pudo validar las credenciales');
    }
  }

  /** Si viene un email, busca el username real en Moodle con el token de servicio. */
  private async resolveMoodleUsername(input: string): Promise<string> {
    if (!input.includes('@')) {
      return input;
    }

    const baseUrl = this.configService.get<string>('MOODLE_URL') || '';
    const serviceToken = this.configService.get<string>('MOODLE_TOKEN');
    if (!baseUrl || !serviceToken) {
      return input;
    }

    try {
      const params = new URLSearchParams({
        wstoken: serviceToken,
        wsfunction: 'core_user_get_users_by_field',
        moodlewsrestformat: 'json',
        field: 'email',
        'values[0]': input,
      });

      const { data } = await firstValueFrom(
        this.httpService.get<Array<{ username?: string }> | { exception?: string }>(
          `${baseUrl}?${params.toString()}`,
        ),
      );

      if (Array.isArray(data) && data[0]?.username) {
        this.logger.log(`Email "${input}" resuelto a username "${data[0].username}"`);
        return data[0].username;
      }
    } catch (error: unknown) {
      this.logger.warn(`No se pudo resolver email "${input}" a username`);
    }

    return input;
  }

  /** Indica si el usuario Moodle es profesor/manager en al menos un curso. */
  async getCapabilities(userToken: string): Promise<AuthCapabilities> {
    const userId = await this.moodleService.getUserIdFromToken(userToken);
    const cacheKey = `auth:capabilities:${userId}`;
    const cached = await this.cache.get<AuthCapabilities>(cacheKey);
    if (cached) return cached;

    const courses = await this.moodleService.getUserCourses(userToken, userId);
    let isTeacher = false;

    for (const course of courses) {
      if (await this.moodleService.isTeacherInCourse(userToken, course.id, userId)) {
        isTeacher = true;
        break;
      }
    }

    const result = { isTeacher };
    await this.cache.set(cacheKey, result, 90_000);
    return result;
  }
}
