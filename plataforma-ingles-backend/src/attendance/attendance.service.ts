import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CalendarService } from '../calendar/calendar.service';
import { ScheduleShift } from '../calendar/schedule-shift.entity';
import { ShiftEnrollment } from '../calendar/shift-enrollment.entity';
import { dateStringInAppTz } from '../common/timezone.util';
import { MoodleService } from '../moodle/moodle.service';
import { AttendanceCheckIn, AttendanceRecordStatus } from './attendance-checkin.entity';
import { AttendanceSession } from './attendance-session.entity';
import { CreateAttendanceSessionDto, MarkAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceCheckIn)
    private readonly checkInRepo: Repository<AttendanceCheckIn>,
    @InjectRepository(ScheduleShift)
    private readonly shiftRepo: Repository<ScheduleShift>,
    @InjectRepository(ShiftEnrollment)
    private readonly enrollmentRepo: Repository<ShiftEnrollment>,
    private readonly calendarService: CalendarService,
    private readonly moodleService: MoodleService,
  ) {}

  private todayDateString(): string {
    return dateStringInAppTz();
  }

  private normalizeDate(input?: string): string {
    if (!input) return this.todayDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new BadRequestException('sessionDate debe ser YYYY-MM-DD');
    }
    return input;
  }

  private isPresent(record: AttendanceCheckIn | undefined): boolean {
    return record?.status === 'present';
  }

  async getTeacherShifts(token: string) {
    return this.calendarService.listTeacherShifts(token);
  }

  async listTeacherSessions(token: string, shiftId: number) {
    await this.calendarService.assertTeacherShift(token, shiftId);

    const sessions = await this.sessionRepo.find({
      where: { shiftId },
      order: { sessionDate: 'DESC' },
    });

    const counts = await Promise.all(
      sessions.map(async (s) => ({
        sessionId: s.id,
        count: await this.checkInRepo.count({
          where: { sessionId: s.id, status: 'present' },
        }),
      })),
    );
    const countMap = new Map(counts.map((c) => [c.sessionId, c.count]));

    return sessions.map((s) => ({
      ...this.serializeSession(s),
      checkInCount: countMap.get(s.id) ?? 0,
    }));
  }

  async createOrGetSession(token: string, dto: CreateAttendanceSessionDto) {
    const { shift } = await this.calendarService.assertTeacherShift(token, dto.shiftId);
    const sessionDate = this.normalizeDate(dto.sessionDate);

    let session = await this.sessionRepo.findOne({
      where: { shiftId: dto.shiftId, sessionDate },
    });

    if (!session) {
      try {
        session = this.sessionRepo.create({
          shiftId: dto.shiftId,
          moodleCourseId: shift.moodleCourseId,
          sessionDate,
          title: dto.title?.trim() || shift.name || `Clase ${sessionDate}`,
          status: 'closed',
          openedByUserId: null,
          openedAt: null,
          closedAt: null,
        });
        session = await this.sessionRepo.save(session);
      } catch (err: unknown) {
        session = await this.sessionRepo.findOne({
          where: { shiftId: dto.shiftId, sessionDate },
        });
        if (!session) throw err;
      }
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
    await this.calendarService.assertTeacherShift(token, session.shiftId);

    session.status = 'open';
    session.openedByUserId = userId;
    session.openedAt = new Date();
    session.closedAt = null;
    const saved = await this.sessionRepo.save(session);
    return this.serializeSession(saved);
  }

  async closeSession(token: string, sessionId: number) {
    const session = await this.findSessionOrFail(sessionId);
    const { userId } = await this.calendarService.assertTeacherShift(token, session.shiftId);

    await this.finalizeAbsences(session, userId);

    session.status = 'closed';
    session.closedAt = new Date();
    const saved = await this.sessionRepo.save(session);
    return this.serializeSession(saved);
  }

  /** Alumnos sin registro quedan ausentes al cerrar. */
  private async finalizeAbsences(session: AttendanceSession, markedByUserId: number) {
    const enrollments = await this.enrollmentRepo.find({
      where: { shiftId: session.shiftId },
    });
    if (!enrollments.length) return;

    const existing = await this.checkInRepo.find({ where: { sessionId: session.id } });
    const haveRecord = new Set(existing.map((c) => c.moodleUserId));

    const toCreate = enrollments
      .filter((e) => !haveRecord.has(e.moodleUserId))
      .map((e) =>
        this.checkInRepo.create({
          sessionId: session.id,
          moodleUserId: e.moodleUserId,
          status: 'absent' as AttendanceRecordStatus,
          markedByUserId,
        }),
      );

    if (toCreate.length) {
      await this.checkInRepo.save(toCreate);
    }
  }

  async getSessionRoster(token: string, sessionId: number) {
    const session = await this.findSessionOrFail(sessionId);
    await this.calendarService.assertTeacherShift(token, session.shiftId);

    const shift = await this.shiftRepo.findOne({
      where: { id: session.shiftId },
      relations: ['folder'],
    });

    const enrollments = await this.enrollmentRepo.find({
      where: { shiftId: session.shiftId },
      order: { createdAt: 'ASC' },
    });

    const checkIns = await this.checkInRepo.find({ where: { sessionId } });
    const checkInMap = new Map(checkIns.map((c) => [c.moodleUserId, c]));

    const userIds = enrollments.map((e) => e.moodleUserId);
    let nameMap = new Map<number, { fullName: string; email: string | null }>();
    try {
      const users = await this.moodleService.getUsersByIds(userIds, token);
      nameMap = new Map(
        users.map((u) => [
          u.id,
          {
            fullName: u.fullname || `User ${u.id}`,
            email: u.email || null,
          },
        ]),
      );
    } catch {
      // Moodle lookup optional — fall back to ids
    }

    const roster = enrollments.map((e) => {
      const checkIn = checkInMap.get(e.moodleUserId);
      const info = nameMap.get(e.moodleUserId);
      const present = this.isPresent(checkIn);
      return {
        moodleUserId: e.moodleUserId,
        fullName: info?.fullName || `User ${e.moodleUserId}`,
        email: info?.email ?? null,
        status: (checkIn?.status as AttendanceRecordStatus | undefined) ?? null,
        present,
        checkedInAt: checkIn?.checkedInAt ?? null,
        markedByUserId: checkIn?.markedByUserId ?? null,
      };
    });

    roster.sort(
      (a, b) =>
        Number(b.present) - Number(a.present) ||
        (a.fullName || '').localeCompare(b.fullName || ''),
    );

    return {
      session: this.serializeSession(session),
      shift: shift
        ? {
            id: shift.id,
            name: shift.name,
            folderName: shift.folder?.name ?? null,
            meetUrl: shift.meetUrl,
            startTime: shift.startTime,
            endTime: shift.endTime,
          }
        : null,
      presentCount: roster.filter((r) => r.present).length,
      absentCount: roster.filter((r) => !r.present).length,
      roster,
    };
  }

  async markAttendance(
    token: string,
    sessionId: number,
    moodleUserId: number,
    dto: MarkAttendanceDto,
  ) {
    const session = await this.findSessionOrFail(sessionId);
    const { userId } = await this.calendarService.assertTeacherShift(token, session.shiftId);

    if (session.status !== 'open') {
      throw new BadRequestException(
        'La asistencia debe estar abierta para marcar presente/ausente',
      );
    }

    const enrolled = await this.enrollmentRepo.findOne({
      where: { shiftId: session.shiftId, moodleUserId },
    });
    if (!enrolled) {
      throw new ForbiddenException('El alumno no está matriculado en este turno');
    }

    const status: AttendanceRecordStatus = dto.present ? 'present' : 'absent';
    const existing = await this.checkInRepo.findOne({
      where: { sessionId, moodleUserId },
    });

    if (existing) {
      existing.status = status;
      existing.markedByUserId = userId;
      await this.checkInRepo.save(existing);
    } else {
      await this.checkInRepo.save(
        this.checkInRepo.create({
          sessionId,
          moodleUserId,
          status,
          markedByUserId: userId,
        }),
      );
    }

    return this.getSessionRoster(token, sessionId);
  }

  async getMyHistory(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);

    const enrollments = await this.enrollmentRepo.find({
      where: { moodleUserId: userId },
    });
    const shiftIds = enrollments.map((e) => e.shiftId);
    if (!shiftIds.length) return [];

    const closedSessions = await this.sessionRepo.find({
      where: { shiftId: In(shiftIds), status: 'closed' },
      relations: ['shift', 'shift.folder'],
      order: { sessionDate: 'DESC' },
      take: 50,
    });
    if (!closedSessions.length) return [];

    const records = await this.checkInRepo.find({
      where: {
        moodleUserId: userId,
        sessionId: In(closedSessions.map((s) => s.id)),
      },
    });
    const bySession = new Map(records.map((r) => [r.sessionId, r]));

    return closedSessions.map((session) => {
      const record = bySession.get(session.id);
      const status: AttendanceRecordStatus = record?.status === 'present' ? 'present' : 'absent';
      return {
        id: record?.id ?? session.id,
        status,
        present: status === 'present',
        checkedInAt: record?.checkedInAt ?? session.closedAt,
        session: this.serializeSession(session),
        shiftName: session.shift?.name ?? null,
        folderName: session.shift?.folder?.name ?? null,
      };
    });
  }

  private async findSessionOrFail(id: number): Promise<AttendanceSession> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Sesión de asistencia no encontrada');
    return session;
  }

  private serializeSession(session: AttendanceSession) {
    return {
      id: session.id,
      shiftId: session.shiftId,
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
