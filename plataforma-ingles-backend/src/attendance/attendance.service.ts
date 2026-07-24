import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { In, Repository } from 'typeorm';
import { MoodleService } from '../moodle/moodle.service';
import { AttendanceCheckIn } from './attendance-checkin.entity';
import { AttendanceSession } from './attendance-session.entity';
import { CreateAttendanceSessionDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceCheckIn)
    private readonly checkInRepo: Repository<AttendanceCheckIn>,
    private readonly moodleService: MoodleService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private todayDateString(): string {
    // Fecha local del servidor (América/Argentina en la mayoría de deploys locales)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private normalizeDate(input?: string): string {
    if (!input) return this.todayDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new BadRequestException('sessionDate debe ser YYYY-MM-DD');
    }
    return input;
  }

  private async assertTeacher(token: string, courseId: number, userId: number): Promise<void> {
    const cacheKey = `att:teacher:${userId}:${courseId}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached === true) return;
    if (cached === false) {
      throw new ForbiddenException('Solo el profesor del curso puede gestionar la asistencia');
    }

    const ok = await this.moodleService.isTeacherInCourse(token, courseId, userId);
    await this.cache.set(cacheKey, ok, 90_000);
    if (!ok) {
      throw new ForbiddenException('Solo el profesor del curso puede gestionar la asistencia');
    }
  }

  async getTeacherCourses(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const cacheKey = `att:teacher-courses:${userId}`;
    const cached = await this.cache.get<Array<{ id: number; name: string }>>(cacheKey);
    if (cached) return cached;

    const courses = await this.moodleService.getUserCourses(token, userId);
    const teacherCourses: Array<{ id: number; name: string }> = [];

    for (const course of courses) {
      const ok = await this.moodleService.isTeacherInCourse(token, course.id, userId);
      await this.cache.set(`att:teacher:${userId}:${course.id}`, ok, 90_000);
      if (ok) {
        teacherCourses.push({
          id: course.id,
          name: course.displayname || course.fullname || course.shortname || `Curso ${course.id}`,
        });
      }
    }

    await this.cache.set(cacheKey, teacherCourses, 90_000);
    return teacherCourses;
  }

  async listTeacherSessions(token: string, courseId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    await this.assertTeacher(token, courseId, userId);

    const sessions = await this.sessionRepo.find({
      where: { moodleCourseId: courseId },
      order: { sessionDate: 'DESC' },
    });

    const counts = await Promise.all(
      sessions.map(async (s) => ({
        sessionId: s.id,
        count: await this.checkInRepo.count({ where: { sessionId: s.id } }),
      })),
    );
    const countMap = new Map(counts.map((c) => [c.sessionId, c.count]));

    return sessions.map((s) => ({
      ...this.serializeSession(s),
      checkInCount: countMap.get(s.id) ?? 0,
    }));
  }

  async createOrGetSession(token: string, dto: CreateAttendanceSessionDto) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    await this.assertTeacher(token, dto.moodleCourseId, userId);

    const sessionDate = this.normalizeDate(dto.sessionDate);
    let session = await this.sessionRepo.findOne({
      where: { moodleCourseId: dto.moodleCourseId, sessionDate },
    });

    if (!session) {
      session = this.sessionRepo.create({
        moodleCourseId: dto.moodleCourseId,
        sessionDate,
        title: dto.title?.trim() || `Clase ${sessionDate}`,
        status: 'closed',
        openedByUserId: null,
        openedAt: null,
        closedAt: null,
      });
      session = await this.sessionRepo.save(session);
    } else if (dto.title?.trim()) {
      session.title = dto.title.trim();
      session = await this.sessionRepo.save(session);
    }

    if (dto.open) {
      return this.openSession(token, session.id);
    }

    return this.serializeSession(session);
  }

  async openSession(token: string, sessionId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const session = await this.findSessionOrFail(sessionId);
    await this.assertTeacher(token, session.moodleCourseId, userId);

    session.status = 'open';
    session.openedByUserId = userId;
    session.openedAt = new Date();
    session.closedAt = null;
    const saved = await this.sessionRepo.save(session);
    return this.serializeSession(saved);
  }

  async closeSession(token: string, sessionId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const session = await this.findSessionOrFail(sessionId);
    await this.assertTeacher(token, session.moodleCourseId, userId);

    session.status = 'closed';
    session.closedAt = new Date();
    const saved = await this.sessionRepo.save(session);
    return this.serializeSession(saved);
  }

  async getSessionRoster(token: string, sessionId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const session = await this.findSessionOrFail(sessionId);
    await this.assertTeacher(token, session.moodleCourseId, userId);

    const enrolled = await this.moodleService.getEnrolledUsers(token, session.moodleCourseId);
    const students = enrolled.filter((u) => {
      if (this.moodleService.hasTeacherRole(u.roles)) return false;
      return this.moodleService.isStudentRole(u.roles);
    });

    const checkIns = await this.checkInRepo.find({ where: { sessionId } });
    const checkInMap = new Map(checkIns.map((c) => [c.moodleUserId, c]));

    const roster = students.map((s) => {
      const checkIn = checkInMap.get(s.id);
      return {
        moodleUserId: s.id,
        fullName: s.fullname || `${s.firstname || ''} ${s.lastname || ''}`.trim() || s.username,
        email: s.email || null,
        present: Boolean(checkIn),
        checkedInAt: checkIn?.checkedInAt ?? null,
      };
    });

    roster.sort((a, b) => Number(b.present) - Number(a.present) || (a.fullName || '').localeCompare(b.fullName || ''));

    return {
      session: this.serializeSession(session),
      presentCount: roster.filter((r) => r.present).length,
      absentCount: roster.filter((r) => !r.present).length,
      roster,
    };
  }

  async getOpenSessionsForStudent(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const courses = await this.moodleService.getUserCourses(token, userId);
    if (!courses.length) return [];

    const courseIds = courses.map((c) => c.id);
    const courseNameMap = new Map(
      courses.map((c) => [
        c.id,
        c.displayname || c.fullname || c.shortname || `Curso ${c.id}`,
      ]),
    );

    const openSessions = await this.sessionRepo.find({
      where: { moodleCourseId: In(courseIds), status: 'open' },
      order: { openedAt: 'DESC' },
    });

    const myCheckIns = openSessions.length
      ? await this.checkInRepo.find({
          where: {
            sessionId: In(openSessions.map((s) => s.id)),
            moodleUserId: userId,
          },
        })
      : [];
    const checkedSet = new Set(myCheckIns.map((c) => c.sessionId));

    return openSessions.map((s) => ({
      ...this.serializeSession(s),
      courseName: courseNameMap.get(s.moodleCourseId) || `Curso ${s.moodleCourseId}`,
      alreadyCheckedIn: checkedSet.has(s.id),
    }));
  }

  async checkIn(token: string, sessionId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const session = await this.findSessionOrFail(sessionId);

    if (session.status !== 'open') {
      throw new BadRequestException('La asistencia de esta clase está cerrada');
    }

    const enrolled = await this.moodleService.isEnrolledInCourse(token, session.moodleCourseId, userId);
    if (!enrolled) {
      throw new ForbiddenException('No estás matriculado en este curso');
    }

    // Profesores no hacen check-in de alumno
    if (await this.moodleService.isTeacherInCourse(token, session.moodleCourseId, userId)) {
      throw new ForbiddenException('Los profesores no marcan asistencia como alumnos');
    }

    const existing = await this.checkInRepo.findOne({
      where: { sessionId, moodleUserId: userId },
    });
    if (existing) {
      throw new ConflictException('Ya marcaste presente en esta clase');
    }

    const saved = await this.checkInRepo.save(
      this.checkInRepo.create({ sessionId, moodleUserId: userId }),
    );

    return {
      message: 'Asistencia registrada',
      checkIn: {
        id: saved.id,
        sessionId: saved.sessionId,
        moodleUserId: saved.moodleUserId,
        checkedInAt: saved.checkedInAt,
      },
      session: this.serializeSession(session),
    };
  }

  async getMyHistory(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const checkIns = await this.checkInRepo.find({
      where: { moodleUserId: userId },
      relations: ['session'],
      order: { checkedInAt: 'DESC' },
      take: 50,
    });

    const courses = await this.moodleService.getUserCourses(token, userId);
    const courseNameMap = new Map(
      courses.map((c) => [
        c.id,
        c.displayname || c.fullname || c.shortname || `Curso ${c.id}`,
      ]),
    );

    return checkIns.map((c) => ({
      id: c.id,
      checkedInAt: c.checkedInAt,
      session: c.session ? this.serializeSession(c.session) : null,
      courseName: c.session
        ? courseNameMap.get(c.session.moodleCourseId) || `Curso ${c.session.moodleCourseId}`
        : null,
    }));
  }

  private async findSessionOrFail(id: number): Promise<AttendanceSession> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Sesión de asistencia no encontrada');
    return session;
  }

  private serializeSession(session: AttendanceSession) {
    return {
      id: session.id,
      moodleCourseId: session.moodleCourseId,
      sessionDate: session.sessionDate,
      title: session.title,
      status: session.status,
      openedByUserId: session.openedByUserId,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
    };
  }
}
