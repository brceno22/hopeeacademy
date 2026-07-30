import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { ProgramEnrollmentSyncService } from '../courses/program-enrollment-sync.service';
import { MoodleService } from '../moodle/moodle.service';
import { CalendarEvent } from './calendar-event.entity';
import { dateStringInAppTz } from '../common/timezone.util';
import {
  buildIcsCalendar,
  CalendarOccurrence,
  expandShiftOccurrences,
  googleCalendarTemplateUrl,
  occurrenceStatus,
} from './calendar.util';
import {
  CreateCalendarEventDto,
  CreateShiftDto,
  EnrollDto,
  UpdateCalendarEventDto,
  UpdateShiftDto,
} from './dto/calendar.dto';
import { ScheduleShift } from './schedule-shift.entity';
import { ShiftEnrollment } from './shift-enrollment.entity';
import { ShiftTeacher } from './shift-teacher.entity';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(ScheduleShift)
    private readonly shiftRepo: Repository<ScheduleShift>,
    @InjectRepository(ShiftEnrollment)
    private readonly enrollmentRepo: Repository<ShiftEnrollment>,
    @InjectRepository(ShiftTeacher)
    private readonly teacherRepo: Repository<ShiftTeacher>,
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(CourseFolder)
    private readonly folderRepo: Repository<CourseFolder>,
    private readonly moodleService: MoodleService,
    private readonly programSync: ProgramEnrollmentSyncService,
  ) {}

  private serializeShift(s: ScheduleShift) {
    return {
      id: s.id,
      name: s.name,
      folderId: s.folderId,
      folderName: s.folder?.name ?? null,
      moodleCourseId: s.moodleCourseId,
      daysOfWeek: s.daysOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      title: s.title,
      description: s.description,
      meetUrl: s.meetUrl,
      validFrom: s.validFrom,
      validTo: s.validTo,
      isActive: s.isActive,
    };
  }

  private async assertFolder(folderId: number) {
    const folder = await this.folderRepo.findOne({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Carpeta no encontrada');
    return folder;
  }

  private normalizeDate(input?: string | null): string | null {
    if (input === undefined || input === null || input === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new BadRequestException('Fecha debe ser YYYY-MM-DD');
    }
    return input;
  }

  // ——— Admin shifts ———

  async adminListShifts() {
    const rows = await this.shiftRepo.find({
      relations: ['folder'],
      order: { name: 'ASC' },
    });
    return rows.map((s) => this.serializeShift(s));
  }

  async adminCreateShift(dto: CreateShiftDto) {
    await this.assertFolder(dto.folderId);
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }
    const saved = await this.shiftRepo.save(
      this.shiftRepo.create({
        name: dto.name.trim(),
        folderId: dto.folderId,
        moodleCourseId: dto.moodleCourseId ?? null,
        daysOfWeek: dto.daysOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        meetUrl: dto.meetUrl?.trim() || null,
        validFrom: this.normalizeDate(dto.validFrom ?? null),
        validTo: this.normalizeDate(dto.validTo ?? null),
        isActive: dto.isActive ?? true,
      }),
    );
    const withFolder = await this.shiftRepo.findOne({
      where: { id: saved.id },
      relations: ['folder'],
    });
    return this.serializeShift(withFolder!);
  }

  async adminUpdateShift(id: number, dto: UpdateShiftDto) {
    const shift = await this.shiftRepo.findOne({ where: { id }, relations: ['folder'] });
    if (!shift) throw new NotFoundException('Turno no encontrado');

    if (dto.folderId != null) {
      await this.assertFolder(dto.folderId);
      shift.folderId = dto.folderId;
    }
    if (dto.name != null) shift.name = dto.name.trim();
    if (dto.moodleCourseId !== undefined) shift.moodleCourseId = dto.moodleCourseId;
    if (dto.daysOfWeek) shift.daysOfWeek = dto.daysOfWeek;
    if (dto.startTime) shift.startTime = dto.startTime;
    if (dto.endTime) shift.endTime = dto.endTime;
    if (dto.title) shift.title = dto.title.trim();
    if (dto.description !== undefined) shift.description = dto.description;
    if (dto.meetUrl !== undefined) shift.meetUrl = dto.meetUrl;
    if (dto.validFrom !== undefined) shift.validFrom = this.normalizeDate(dto.validFrom);
    if (dto.validTo !== undefined) shift.validTo = this.normalizeDate(dto.validTo);
    if (dto.isActive != null) shift.isActive = dto.isActive;

    if (shift.startTime >= shift.endTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }

    await this.shiftRepo.save(shift);
    const refreshed = await this.shiftRepo.findOne({ where: { id }, relations: ['folder'] });
    return this.serializeShift(refreshed!);
  }

  async adminDeleteShift(id: number) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    await this.shiftRepo.remove(shift);
    return { message: 'Turno eliminado', id };
  }

  // ——— Enrollments ———

  private async enrichMembers<T extends { moodleUserId: number }>(
    rows: T[],
  ): Promise<
    Array<
      T & {
        fullName: string;
        email: string | null;
        username: string | null;
      }
    >
  > {
    const ids = rows.map((r) => r.moodleUserId);
    let nameMap = new Map<
      number,
      { fullName: string; email: string | null; username: string | null }
    >();
    try {
      const users = await this.moodleService.getUsersByIds(ids);
      nameMap = new Map(
        users.map((u) => [
          u.id,
          {
            fullName: u.fullname || `User ${u.id}`,
            email: u.email || null,
            username: u.username || null,
          },
        ]),
      );
    } catch {
      // optional
    }
    return rows.map((r) => {
      const info = nameMap.get(r.moodleUserId);
      return {
        ...r,
        fullName: info?.fullName || `User ${r.moodleUserId}`,
        email: info?.email ?? null,
        username: info?.username ?? null,
      };
    });
  }

  async listEnrollments(shiftId: number) {
    await this.getShiftOrFail(shiftId);
    const rows = await this.enrollmentRepo.find({
      where: { shiftId },
      order: { createdAt: 'DESC' },
    });
    const base = rows.map((e) => ({
      id: e.id,
      shiftId: e.shiftId,
      moodleUserId: e.moodleUserId,
      assignedByUserId: e.assignedByUserId,
      createdAt: e.createdAt,
    }));
    return this.enrichMembers(base);
  }

  async enroll(shiftId: number, dto: EnrollDto, assignedByUserId?: number | null) {
    const shift = await this.getShiftOrFail(shiftId);
    const existing = await this.enrollmentRepo.findOne({
      where: { shiftId, moodleUserId: dto.moodleUserId },
    });
    if (existing) return existing;

    const saved = await this.enrollmentRepo.save(
      this.enrollmentRepo.create({
        shiftId,
        moodleUserId: dto.moodleUserId,
        assignedByUserId: assignedByUserId ?? null,
      }),
    );

    try {
      await this.programSync.enrolUserInProgram(shift.folderId, dto.moodleUserId, 'student');
    } catch (err) {
      await this.enrollmentRepo.remove(saved);
      throw err;
    }

    return saved;
  }

  async unenroll(shiftId: number, moodleUserId: number) {
    const shift = await this.getShiftOrFail(shiftId);
    const row = await this.enrollmentRepo.findOne({
      where: { shiftId, moodleUserId },
    });
    if (!row) throw new NotFoundException('Alumno no está en este turno');
    await this.enrollmentRepo.remove(row);
    await this.programSync.unenrolUserFromProgramIfOrphan(shift.folderId, moodleUserId, 'student');
    return { message: 'Alumno quitado del turno' };
  }

  // ——— Teachers ———

  async listTeachers(shiftId: number) {
    await this.getShiftOrFail(shiftId);
    const rows = await this.teacherRepo.find({
      where: { shiftId },
      order: { createdAt: 'DESC' },
    });
    const base = rows.map((t) => ({
      id: t.id,
      shiftId: t.shiftId,
      moodleUserId: t.moodleUserId,
      assignedByUserId: t.assignedByUserId,
      createdAt: t.createdAt,
    }));
    return this.enrichMembers(base);
  }

  async assignTeacher(shiftId: number, dto: EnrollDto, assignedByUserId?: number | null) {
    const shift = await this.getShiftOrFail(shiftId);
    const existing = await this.teacherRepo.findOne({
      where: { shiftId, moodleUserId: dto.moodleUserId },
    });
    if (existing) return existing;

    const saved = await this.teacherRepo.save(
      this.teacherRepo.create({
        shiftId,
        moodleUserId: dto.moodleUserId,
        assignedByUserId: assignedByUserId ?? null,
      }),
    );

    try {
      await this.programSync.enrolUserInProgram(shift.folderId, dto.moodleUserId, 'teacher');
    } catch (err) {
      await this.teacherRepo.remove(saved);
      throw err;
    }

    return saved;
  }

  async unassignTeacher(shiftId: number, moodleUserId: number) {
    const shift = await this.getShiftOrFail(shiftId);
    const row = await this.teacherRepo.findOne({
      where: { shiftId, moodleUserId },
    });
    if (!row) throw new NotFoundException('Profesor no está asignado a este turno');
    await this.teacherRepo.remove(row);
    await this.programSync.unenrolUserFromProgramIfOrphan(shift.folderId, moodleUserId, 'teacher');
    return { message: 'Profesor quitado del turno' };
  }

  // ——— Events ———

  async adminListEvents(shiftId?: number) {
    const where = shiftId ? { shiftId } : {};
    const rows = await this.eventRepo.find({
      where,
      relations: ['shift', 'shift.folder'],
      order: { startsAt: 'DESC' },
    });
    return rows.map((e) => this.serializeEvent(e));
  }

  async createEvent(dto: CreateCalendarEventDto) {
    await this.getShiftOrFail(dto.shiftId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(startsAt < endsAt)) {
      throw new BadRequestException('startsAt debe ser anterior a endsAt');
    }
    const saved = await this.eventRepo.save(
      this.eventRepo.create({
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        meetUrl: dto.meetUrl?.trim() || null,
        startsAt,
        endsAt,
        shiftId: dto.shiftId,
        isActive: dto.isActive ?? true,
      }),
    );
    const full = await this.eventRepo.findOne({
      where: { id: saved.id },
      relations: ['shift', 'shift.folder'],
    });
    return this.serializeEvent(full!);
  }

  async getEventOrFail(id: number) {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['shift', 'shift.folder'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async updateEvent(id: number, dto: UpdateCalendarEventDto) {
    const event = await this.getEventOrFail(id);

    if (dto.shiftId != null) {
      await this.getShiftOrFail(dto.shiftId);
      event.shiftId = dto.shiftId;
    }
    if (dto.title != null) event.title = dto.title.trim();
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.meetUrl !== undefined) event.meetUrl = dto.meetUrl;
    if (dto.startsAt) event.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) event.endsAt = new Date(dto.endsAt);
    if (dto.isActive != null) event.isActive = dto.isActive;

    if (!(event.startsAt < event.endsAt)) {
      throw new BadRequestException('startsAt debe ser anterior a endsAt');
    }

    await this.eventRepo.save(event);
    const full = await this.eventRepo.findOne({
      where: { id },
      relations: ['shift', 'shift.folder'],
    });
    return this.serializeEvent(full!);
  }

  async deleteEvent(id: number) {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    await this.eventRepo.remove(event);
    return { message: 'Evento eliminado', id };
  }

  private serializeEvent(e: CalendarEvent) {
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      meetUrl: e.meetUrl,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      shiftId: e.shiftId,
      shiftName: e.shift?.name ?? null,
      folderName: e.shift?.folder?.name ?? null,
      isActive: e.isActive,
    };
  }

  // ——— Teacher permissions ———

  async teacherCanManageShift(_token: string, userId: number, shift: ScheduleShift): Promise<boolean> {
    const row = await this.teacherRepo.findOne({
      where: { shiftId: shift.id, moodleUserId: userId },
    });
    return Boolean(row);
  }

  async listTeacherShifts(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const assignments = await this.teacherRepo.find({
      where: { moodleUserId: userId },
      relations: ['shift', 'shift.folder'],
    });

    return assignments
      .map((a) => a.shift)
      .filter((s): s is ScheduleShift => Boolean(s?.isActive))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => this.serializeShift(s));
  }

  async assertTeacherShift(token: string, shiftId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const shift = await this.getShiftOrFail(shiftId);
    if (!(await this.teacherCanManageShift(token, userId, shift))) {
      throw new ForbiddenException('No podés gestionar este turno');
    }
    return { userId, shift };
  }

  // ——— Student / teacher calendar ———

  private parseRange(from?: string, to?: string) {
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException('Parámetros from y to requeridos (YYYY-MM-DD)');
    }
    if (from > to) throw new BadRequestException('from debe ser <= to');
    return { from, to };
  }

  private async loadActiveShiftsForUser(userId: number): Promise<ScheduleShift[]> {
    const [enrollments, assignments] = await Promise.all([
      this.enrollmentRepo.find({
        where: { moodleUserId: userId },
        relations: ['shift', 'shift.folder'],
      }),
      this.teacherRepo.find({
        where: { moodleUserId: userId },
        relations: ['shift', 'shift.folder'],
      }),
    ]);

    const byId = new Map<number, ScheduleShift>();
    for (const row of [...enrollments, ...assignments]) {
      const shift = row.shift;
      if (shift?.isActive) byId.set(shift.id, shift);
    }
    return [...byId.values()];
  }

  private async loadActiveTeacherShifts(userId: number): Promise<ScheduleShift[]> {
    const assignments = await this.teacherRepo.find({
      where: { moodleUserId: userId },
      relations: ['shift', 'shift.folder'],
    });
    return assignments
      .map((a) => a.shift)
      .filter((s): s is ScheduleShift => Boolean(s?.isActive));
  }

  /** Expande turnos recurrentes + eventos one-off en el rango. */
  async buildOccurrencesForShifts(
    shifts: ScheduleShift[],
    from: string,
    to: string,
  ): Promise<CalendarOccurrence[]> {
    const occurrences: CalendarOccurrence[] = [];

    for (const shift of shifts) {
      occurrences.push(
        ...expandShiftOccurrences({
          shiftId: shift.id,
          shiftName: shift.name,
          folderName: shift.folder?.name ?? null,
          title: shift.title,
          description: shift.description,
          meetUrl: shift.meetUrl,
          daysOfWeek: shift.daysOfWeek,
          startTime: shift.startTime,
          endTime: shift.endTime,
          validFrom: shift.validFrom,
          validTo: shift.validTo,
          from,
          to,
        }),
      );
    }

    const shiftIds = shifts.map((s) => s.id);
    if (shiftIds.length) {
      const fromDate = new Date(`${from}T00:00:00.000Z`);
      const toDate = new Date(`${to}T23:59:59.999Z`);
      // Ampliar un día por timezone Guayaquil (UTC-5)
      fromDate.setUTCHours(fromDate.getUTCHours() - 5);
      toDate.setUTCHours(toDate.getUTCHours() + 5);

      const events = await this.eventRepo.find({
        where: {
          shiftId: In(shiftIds),
          isActive: true,
          startsAt: Between(fromDate, toDate),
        },
        relations: ['shift', 'shift.folder'],
      });

      for (const e of events) {
        occurrences.push({
          id: `event-${e.id}`,
          source: 'event',
          sourceId: e.id,
          title: e.title,
          description: e.description,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          meetUrl: e.meetUrl,
          shiftId: e.shiftId,
          shiftName: e.shift?.name ?? '',
          folderName: e.shift?.folder?.name ?? null,
        });
      }
    }

    occurrences.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return occurrences;
  }

  async getMyOccurrences(token: string, from?: string, to?: string): Promise<CalendarOccurrence[]> {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const range = this.parseRange(from, to);
    const activeShifts = await this.loadActiveShiftsForUser(userId);
    const occurrences = await this.buildOccurrencesForShifts(
      activeShifts,
      range.from,
      range.to,
    );
    return occurrences.map((o) => ({
      ...o,
      googleUrl: googleCalendarTemplateUrl(o),
    }));
  }

  async getTeacherToday(token: string, now: Date = new Date()): Promise<CalendarOccurrence[]> {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const today = dateStringInAppTz(now);
    const shifts = await this.loadActiveTeacherShifts(userId);
    if (!shifts.length) return [];

    const occurrences = await this.buildOccurrencesForShifts(shifts, today, today);
    const withStatus = occurrences.map((o) => ({
      ...o,
      status: occurrenceStatus(o.startsAt, o.endsAt, now),
      googleUrl: googleCalendarTemplateUrl(o),
    }));

    const rank = { live: 0, upcoming: 1, done: 2 } as const;
    withStatus.sort((a, b) => {
      const ra = rank[a.status];
      const rb = rank[b.status];
      if (ra !== rb) return ra - rb;
      return a.startsAt.localeCompare(b.startsAt);
    });
    return withStatus;
  }

  async getMyIcs(token: string, from?: string, to?: string): Promise<string> {
    const occurrences = await this.getMyOccurrences(token, from, to);
    return buildIcsCalendar(occurrences, 'Hopee Academy');
  }

  private async getShiftOrFail(id: number): Promise<ScheduleShift> {
    const shift = await this.shiftRepo.findOne({ where: { id }, relations: ['folder'] });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    return shift;
  }
}
