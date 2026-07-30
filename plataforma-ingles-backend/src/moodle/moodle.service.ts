import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
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
const ROLE_CACHE_TTL_MS = 90_000;
const USERS_DIRECTORY_CACHE_KEY = 'moodle:users:directory';
const USERS_DIRECTORY_TTL_MS = 10 * 60 * 1000;

export type MoodleDirectoryUser = {
  id: number;
  fullname: string;
  email: string;
  username: string;
};

@Injectable()
export class MoodleService {
  private readonly logger = new Logger(MoodleService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
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
    const cacheKey = `moodle:teacher:${uid}:${courseId}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== undefined && cached !== null) return cached;

    const enrolled = await this.getEnrolledUsers(userToken, courseId);
    const me = enrolled.find((u) => u.id === uid);
    const result = this.hasTeacherRole(me?.roles);
    await this.cache.set(cacheKey, result, ROLE_CACHE_TTL_MS);
    return result;
  }

  async isEnrolledInCourse(userToken: string, courseId: number, userId?: number): Promise<boolean> {
    const uid = userId ?? (await this.getUserIdFromToken(userToken));
    const cacheKey = `moodle:enrolled:${uid}:${courseId}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== undefined && cached !== null) return cached;

    const courses = await this.getUserCourses(userToken, uid);
    const result = courses.some((c) => c.id === courseId);
    await this.cache.set(cacheKey, result, ROLE_CACHE_TTL_MS);
    return result;
  }

  /** Lookup Moodle users by id (admin token or user token). */
  async getUsersByIds(
    userIds: number[],
    userToken?: string,
  ): Promise<
    Array<{
      id: number;
      fullname?: string;
      firstname?: string;
      lastname?: string;
      email?: string;
      username?: string;
    }>
  > {
    if (!userIds.length) return [];
    const params: MoodleParams = { field: 'id' };
    userIds.forEach((id, i) => {
      params[`values[${i}]`] = id;
    });
    const data = await this.request<
      | Array<Record<string, unknown>>
      | { users?: Array<Record<string, unknown>> }
    >('core_user_get_users_by_field', params, userToken);

    const users = Array.isArray(data)
      ? data
      : Array.isArray(data?.users)
        ? data.users
        : [];

    return users.map((u) => ({
      id: u.id as number,
      fullname:
        (u.fullname as string) ||
        `${(u.firstname as string) || ''} ${(u.lastname as string) || ''}`.trim() ||
        (u.username as string),
      firstname: u.firstname as string | undefined,
      lastname: u.lastname as string | undefined,
      email: u.email as string | undefined,
      username: u.username as string | undefined,
    }));
  }

  /**
   * Directorio completo de usuarios Moodle (cache ~10 min).
   * Se obtiene una vez con comodín y luego searchUsers filtra en memoria.
   */
  async getUsersDirectory(forceRefresh = false): Promise<MoodleDirectoryUser[]> {
    if (!forceRefresh) {
      const cached = await this.cache.get<MoodleDirectoryUser[]>(USERS_DIRECTORY_CACHE_KEY);
      if (cached?.length) return cached;
    }

    const rawUsers = await this.fetchAllMoodleUsers();
    const directory = rawUsers
      .map((u) => this.mapMoodleUserRow(u))
      .filter((u): u is MoodleDirectoryUser => u != null)
      .sort((a, b) => a.fullname.localeCompare(b.fullname, 'es', { sensitivity: 'base' }));

    await this.cache.set(USERS_DIRECTORY_CACHE_KEY, directory, USERS_DIRECTORY_TTL_MS);
    this.logger.log(`Moodle users directory cached (${directory.length} users)`);
    return directory;
  }

  private async fetchAllMoodleUsers(): Promise<Array<Record<string, unknown>>> {
    const attempts: Array<{ key: string; value: string }> = [
      { key: 'email', value: '%' },
      { key: 'email', value: '%%' },
      { key: 'lastname', value: '%' },
      { key: 'username', value: '%' },
    ];

    for (const attempt of attempts) {
      try {
        const data = await this.request<{ users?: Array<Record<string, unknown>> }>(
          'core_user_get_users',
          {
            'criteria[0][key]': attempt.key,
            'criteria[0][value]': attempt.value,
          },
        );
        const users = Array.isArray(data?.users) ? data.users : [];
        if (users.length > 0) {
          this.logger.debug(
            `fetchAllMoodleUsers via ${attempt.key}=${attempt.value} → ${users.length}`,
          );
          return users;
        }
      } catch (err) {
        this.logger.warn(
          `fetchAllMoodleUsers(${attempt.key}=${attempt.value}) failed: ${(err as Error)?.message ?? err}`,
        );
      }
    }

    this.logger.error('Could not load Moodle users directory (all wildcard attempts failed)');
    return [];
  }

  private mapMoodleUserRow(u: Record<string, unknown>): MoodleDirectoryUser | null {
    const id = Number(u.id);
    if (!Number.isFinite(id) || id < 1) return null;
    // Guest / deleted / suspended
    if (id === 1) return null;
    if (u.deleted === true || u.deleted === 1 || u.deleted === '1') return null;
    if (u.suspended === true || u.suspended === 1 || u.suspended === '1') return null;

    const firstname = (u.firstname as string) || '';
    const lastname = (u.lastname as string) || '';
    const fullname =
      (u.fullname as string) ||
      `${firstname} ${lastname}`.trim() ||
      (u.username as string) ||
      `User ${id}`;

    return {
      id,
      fullname,
      email: (u.email as string) || '',
      username: (u.username as string) || '',
    };
  }

  /**
   * Autocomplete admin: filtra el directorio cacheado (no consulta Moodle por cada tecla).
   */
  async searchUsers(query: string, limit = 20): Promise<MoodleDirectoryUser[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const directory = await this.getUsersDirectory();
    const needle = q.toLowerCase();
    return directory
      .filter((u) => {
        const hay = `${u.fullname} ${u.email} ${u.username}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, limit);
  }

  getStudentRoleId(): number {
    const raw = this.configService.get<string>('MOODLE_STUDENT_ROLE_ID');
    const n = raw ? Number(raw) : 5;
    return Number.isFinite(n) && n > 0 ? n : 5;
  }

  getTeacherRoleId(): number {
    const raw = this.configService.get<string>('MOODLE_TEACHER_ROLE_ID');
    const n = raw ? Number(raw) : 3;
    return Number.isFinite(n) && n > 0 ? n : 3;
  }

  /**
   * Matricula masiva vía enrol_manual (requiere MOODLE_TOKEN + plugin manual).
   * enrolments[]: roleid, userid, courseid
   */
  async enrolUsers(
    enrolments: Array<{ courseId: number; userId: number; roleId: number }>,
  ): Promise<void> {
    if (!enrolments.length) return;
    const params: MoodleParams = {};
    enrolments.forEach((e, i) => {
      params[`enrolments[${i}][roleid]`] = e.roleId;
      params[`enrolments[${i}][userid]`] = e.userId;
      params[`enrolments[${i}][courseid]`] = e.courseId;
    });
    try {
      await this.requestPostForm('enrol_manual_enrol_users', params);
    } catch (err: unknown) {
      if (err instanceof HttpException && this.isHttpMessageNotSent(err)) {
        this.logger.warn(
          'Moodle enrol_manual_enrol_users: ignoring notification failure (enrolment likely OK)',
        );
        return;
      }
      if (err instanceof HttpException) {
        const body = err.getResponse();
        const msg =
          typeof body === 'object' && body && 'message' in body
            ? String((body as { message: unknown }).message)
            : err.message;
        throw new BadGatewayException(
          `No se pudo matricular en Moodle (${msg}). Verificá matrícula manual y permisos WS enrol_manual_enrol_users.`,
        );
      }
      throw err;
    }
  }

  /** Desmatricula masiva vía enrol_manual_unenrol_users. */
  async unenrolUsers(enrolments: Array<{ courseId: number; userId: number }>): Promise<void> {
    if (!enrolments.length) return;
    const params: MoodleParams = {};
    enrolments.forEach((e, i) => {
      params[`enrolments[${i}][userid]`] = e.userId;
      params[`enrolments[${i}][courseid]`] = e.courseId;
    });
    try {
      await this.requestPostForm('enrol_manual_unenrol_users', params);
    } catch (err: unknown) {
      if (err instanceof HttpException && this.isHttpMessageNotSent(err)) {
        this.logger.warn(
          'Moodle enrol_manual_unenrol_users: ignoring notification failure (unenrol likely OK)',
        );
        return;
      }
      if (err instanceof HttpException) {
        const body = err.getResponse();
        const msg =
          typeof body === 'object' && body && 'message' in body
            ? String((body as { message: unknown }).message)
            : err.message;
        throw new BadGatewayException(
          `No se pudo desmatricular en Moodle (${msg}). Verificá permisos WS enrol_manual_unenrol_users.`,
        );
      }
      throw err;
    }
  }

  private isHttpMessageNotSent(err: HttpException): boolean {
    const body = err.getResponse();
    const text =
      typeof body === 'string'
        ? body
        : typeof body === 'object' && body
          ? JSON.stringify(body)
          : err.message;
    return text.toLowerCase().includes('message was not sent');
  }

  private assertNoMoodleException(data: unknown, wsFunction: string): void {
    if (!data || typeof data !== 'object') return;
    const payload = data as MoodleExceptionPayload;
    if (!payload.exception && !payload.errorcode) return;

    const code = (payload.errorcode || payload.exception || '').toLowerCase();
    const message = payload.message || 'Error en Moodle Web Services';

    this.logger.warn(`Moodle [${wsFunction}] exception: ${code} — ${message}`);

    // Enrolment often succeeds; Moodle then fails sending welcome/notification email.
    if (this.isMessageNotSentNoise(wsFunction, code, message)) {
      this.logger.warn(
        `Moodle [${wsFunction}]: ignoring notification failure (enrolment likely OK)`,
      );
      return;
    }

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

    if (
      code.includes('cannotcreatediscussion') ||
      code.includes('cannotadddiscussion') ||
      message.toLowerCase().includes('could not create new discussion')
    ) {
      throw new ForbiddenException(
        'No se pudo crear la discusión en Moodle. Revisá permisos del foro, grupos y que no sea solo de avisos.',
      );
    }

    throw new BadGatewayException({
      message: `Error de Moodle: ${message}`,
      errorcode: payload.errorcode,
      wsFunction,
    });
  }

  /** SMTP/notification failures after enrol_manual — not a real enrolment failure. */
  private isMessageNotSentNoise(wsFunction: string, code: string, message: string): boolean {
    if (
      wsFunction !== 'enrol_manual_enrol_users' &&
      wsFunction !== 'enrol_manual_unenrol_users'
    ) {
      return false;
    }
    const text = `${code} ${message}`.toLowerCase();
    return text.includes('message was not sent') || text.includes('error/message was not sent');
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
