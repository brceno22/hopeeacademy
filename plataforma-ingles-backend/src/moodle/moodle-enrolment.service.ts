import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MoodleClientService } from './moodle-client.service';
import { MoodleEnrolledUser, MoodleParams, MoodleSiteInfo, MoodleUserCourse } from './moodle.types';

const TEACHER_ROLE_SHORTNAMES = new Set(['editingteacher', 'teacher', 'manager']);
const ROLE_CACHE_TTL_MS = 90_000;

@Injectable()
export class MoodleEnrolmentService {
  private readonly logger = new Logger(MoodleEnrolmentService.name);

  constructor(
    private readonly client: MoodleClientService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Resuelve el userId Moodle a partir del wstoken del alumno. */
  async getUserIdFromToken(userToken: string): Promise<number> {
    const info = await this.getSiteInfo(userToken);
    if (!info?.userid) {
      throw new UnauthorizedException('Token de Moodle inválido o expirado');
    }
    return info.userid;
  }

  async getSiteInfo(userToken: string): Promise<MoodleSiteInfo> {
    return this.client.request<MoodleSiteInfo>('core_webservice_get_site_info', {}, userToken);
  }

  async getUserCourses(userToken: string, userId: number): Promise<MoodleUserCourse[]> {
    const data = await this.client.request<MoodleUserCourse[]>(
      'core_enrol_get_users_courses',
      { userid: userId },
      userToken,
    );
    return Array.isArray(data) ? data : [];
  }

  async getEnrolledUsers(userToken: string, courseId: number): Promise<MoodleEnrolledUser[]> {
    const data = await this.client.request<MoodleEnrolledUser[]>(
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
      await this.client.requestPostForm('enrol_manual_enrol_users', params);
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
            ? String(body.message)
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
      await this.client.requestPostForm('enrol_manual_unenrol_users', params);
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
            ? String(body.message)
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
}
