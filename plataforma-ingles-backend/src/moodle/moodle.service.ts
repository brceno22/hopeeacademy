import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import FormData from 'form-data';
import { firstValueFrom } from 'rxjs';
import {
  MoodleEnrolledUser,
  MoodleExceptionPayload,
  MoodleParams,
  MoodleSiteInfo,
  MoodleUserCourse,
} from './moodle.types';

const TEACHER_ROLE_SHORTNAMES = new Set(['editingteacher', 'teacher', 'manager']);

@Injectable()
export class MoodleService {
  private readonly logger = new Logger(MoodleService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async request<T = unknown>(
    wsFunction: string,
    extraParams: MoodleParams = {},
    userToken?: string,
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('MOODLE_URL');
    if (!baseUrl) {
      throw new BadGatewayException('MOODLE_URL no está configurada');
    }

    const token = userToken || this.configService.get<string>('MOODLE_TOKEN');
    if (!token) {
      throw new UnauthorizedException('Token de Moodle no disponible');
    }

    const paramsObjeto: Record<string, string> = {
      wstoken: token,
      wsfunction: wsFunction,
      moodlewsrestformat: 'json',
    };

    for (const [key, value] of Object.entries(extraParams)) {
      if (value === undefined || value === null) continue;
      paramsObjeto[key] = String(value);
    }

    const urlFinal = `${baseUrl}?${new URLSearchParams(paramsObjeto).toString()}`;

    try {
      const { data } = await firstValueFrom(this.httpService.get<T | MoodleExceptionPayload>(urlFinal));
      this.assertNoMoodleException(data, wsFunction);
      return data as T;
    } catch (error: unknown) {
      throw this.mapError(error, wsFunction);
    }
  }

  async requestPostForm<T = unknown>(
    wsFunction: string,
    extraParams: MoodleParams = {},
    userToken?: string,
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('MOODLE_URL') ?? '';
    if (!baseUrl) {
      throw new BadGatewayException('MOODLE_URL no está configurada');
    }

    const token = userToken ?? this.configService.get<string>('MOODLE_TOKEN') ?? '';
    if (!token) {
      throw new UnauthorizedException('Token de Moodle no disponible');
    }

    const form = new FormData();
    form.append('wstoken', token);
    form.append('wsfunction', wsFunction);
    form.append('moodlewsrestformat', 'json');

    for (const [key, value] of Object.entries(extraParams)) {
      if (value === undefined || value === null) continue;
      form.append(key, String(value));
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<T | MoodleExceptionPayload>(baseUrl, form, {
          headers: form.getHeaders(),
        }),
      );
      this.assertNoMoodleException(data, wsFunction);
      return data as T;
    } catch (error: unknown) {
      throw this.mapError(error, wsFunction);
    }
  }

  /** Resuelve el userId Moodle a partir del wstoken del alumno. */
  async getUserIdFromToken(userToken: string): Promise<number> {
    const info = await this.getSiteInfo(userToken);
    if (!info?.userid) {
      throw new UnauthorizedException('Token de Moodle inválido o expirado');
    }
    return info.userid;
  }

  async getSiteInfo(userToken: string): Promise<MoodleSiteInfo> {
    return this.request<MoodleSiteInfo>('core_webservice_get_site_info', {}, userToken);
  }

  async getUserCourses(userToken: string, userId: number): Promise<MoodleUserCourse[]> {
    const data = await this.request<MoodleUserCourse[]>(
      'core_enrol_get_users_courses',
      { userid: userId },
      userToken,
    );
    return Array.isArray(data) ? data : [];
  }

  async getEnrolledUsers(userToken: string, courseId: number): Promise<MoodleEnrolledUser[]> {
    const data = await this.request<MoodleEnrolledUser[]>(
      'core_enrol_get_enrolled_users',
      { courseid: courseId },
      userToken,
    );
    return Array.isArray(data) ? data : [];
  }

  hasTeacherRole(roles?: { shortname?: string }[]): boolean {
    if (!roles?.length) return false;
    return roles.some((r) => r.shortname && TEACHER_ROLE_SHORTNAMES.has(r.shortname));
  }

  isStudentRole(roles?: { shortname?: string }[]): boolean {
    if (!roles?.length) return true;
    if (this.hasTeacherRole(roles)) return false;
    return roles.some((r) => r.shortname === 'student') || roles.length > 0;
  }

  async isTeacherInCourse(userToken: string, courseId: number, userId?: number): Promise<boolean> {
    const uid = userId ?? (await this.getUserIdFromToken(userToken));
    const enrolled = await this.getEnrolledUsers(userToken, courseId);
    const me = enrolled.find((u) => u.id === uid);
    return this.hasTeacherRole(me?.roles);
  }

  async isEnrolledInCourse(userToken: string, courseId: number, userId?: number): Promise<boolean> {
    const uid = userId ?? (await this.getUserIdFromToken(userToken));
    const courses = await this.getUserCourses(userToken, uid);
    return courses.some((c) => c.id === courseId);
  }

  private assertNoMoodleException(data: unknown, wsFunction: string): void {
    if (!data || typeof data !== 'object') return;
    const payload = data as MoodleExceptionPayload;
    if (!payload.exception && !payload.errorcode) return;

    const code = (payload.errorcode || payload.exception || '').toLowerCase();
    const message = payload.message || 'Error en Moodle Web Services';

    this.logger.warn(`Moodle [${wsFunction}] exception: ${code} — ${message}`);

    if (
      code.includes('invalidtoken') ||
      code.includes('accessexception') ||
      code.includes('invalid_token') ||
      message.toLowerCase().includes('invalid token')
    ) {
      throw new UnauthorizedException('Sesión de Moodle inválida o expirada');
    }

    if (
      code.includes('coursenotfound') ||
      code.includes('invalidrecord') ||
      code.includes('notfound') ||
      message.toLowerCase().includes('not found')
    ) {
      throw new NotFoundException(message);
    }

    if (
      code.includes('notenrolled') ||
      code.includes('requirelogin') ||
      message.toLowerCase().includes('not enrolled')
    ) {
      throw new UnauthorizedException('No estás matriculado o no tenés permiso para este recurso');
    }

    throw new BadGatewayException({
      message: `Error de Moodle: ${message}`,
      errorcode: payload.errorcode,
      wsFunction,
    });
  }

  private mapError(error: unknown, wsFunction: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    const axiosError = error as AxiosError;
    const code = axiosError?.code || '';
    const status = axiosError?.response?.status;

    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNABORTED'
    ) {
      this.logger.error(`Moodle unreachable [${wsFunction}]: ${code}`);
      throw new BadGatewayException(
        'No se pudo conectar con Moodle. Verificá que el servicio esté disponible.',
      );
    }

    if (status === 401 || status === 403) {
      throw new UnauthorizedException('Acceso denegado por Moodle');
    }

    if (status === 404) {
      throw new NotFoundException('Recurso no encontrado en Moodle');
    }

    const message =
      axiosError?.message ||
      (error instanceof Error ? error.message : 'Error de conexión con Moodle');

    this.logger.error(`Moodle [${wsFunction}] failed: ${message}`);
    throw new BadGatewayException(`Error al comunicarse con Moodle: ${message}`);
  }
}
