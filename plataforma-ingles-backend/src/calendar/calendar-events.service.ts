import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { MoodleService } from '../moodle/moodle.service';
import { dateStringInAppTz } from '../common/timezone.util';
import { CalendarEvent } from './calendar-event.entity';
import {
  buildIcsCalendar,
  CalendarOccurrence,
  expandShiftOccurrences,
  googleCalendarTemplateUrl,
  occurrenceStatus,
} from './calendar.util';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar.dto';
import { ScheduleShift } from './schedule-shift.entity';
import { ShiftEnrollment } from './shift-enrollment.entity';
import { ShiftTeacher } from './shift-teacher.entity';
import { ShiftAdminService } from './shift-admin.service';

@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(ShiftEnrollment)
    private readonly enrollmentRepo: Repository<ShiftEnrollment>,
    @InjectRepository(ShiftTeacher)
    private readonly teacherRepo: Repository<ShiftTeacher>,
    private readonly moodleService: MoodleService,
    private readonly shiftAdmin: ShiftAdminService,
  ) {}

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
    await this.shiftAdmin.getShiftOrFail(dto.shiftId);
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
      await this.shiftAdmin.getShiftOrFail(dto.shiftId);
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
    return assignments.map((a) => a.shift).filter((s): s is ScheduleShift => Boolean(s?.isActive));
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
    const occurrences = await this.buildOccurrencesForShifts(activeShifts, range.from, range.to);
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
}
