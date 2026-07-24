import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { CourseFolderLink } from '../courses/entities/course-folder-link.entity';
import { MoodleService } from '../moodle/moodle.service';
import { CalendarEvent } from './calendar-event.entity';
import {
  buildIcsCalendar,
  CalendarOccurrence,
  expandShiftOccurrences,
  googleCalendarTemplateUrl,
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

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(ScheduleShift)
    private readonly shiftRepo: Repository<ScheduleShift>,
    @InjectRepository(ShiftEnrollment)
    private readonly enrollmentRepo: Repository<ShiftEnrollment>,
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(CourseFolder)
    private readonly folderRepo: Repository<CourseFolder>,
    @InjectRepository(CourseFolderLink)
    private readonly linkRepo: Repository<CourseFolderLink>,
    private readonly moodleService: MoodleService,
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

  async listEnrollments(shiftId: number) {
    await this.getShiftOrFail(shiftId);
    const rows = await this.enrollmentRepo.find({
      where: { shiftId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((e) => ({
      id: e.id,
      shiftId: e.shiftId,
      moodleUserId: e.moodleUserId,
      assignedByUserId: e.assignedByUserId,
      createdAt: e.createdAt,
    }));
  }

  async enroll(shiftId: number, dto: EnrollDto, assignedByUserId?: number | null) {
    await this.getShiftOrFail(shiftId);
    const existing = await this.enrollmentRepo.findOne({
      where: { shiftId, moodleUserId: dto.moodleUserId },
    });
    if (existing) return existing;

    return this.enrollmentRepo.save(
      this.enrollmentRepo.create({
        shiftId,
        moodleUserId: dto.moodleUserId,
        assignedByUserId: assignedByUserId ?? null,
      }),
    );
  }

  async unenroll(shiftId: number, moodleUserId: number) {
    const row = await this.enrollmentRepo.findOne({
      where: { shiftId, moodleUserId },
    });
    if (!row) throw new NotFoundException('Alumno no está en este turno');
    await this.enrollmentRepo.remove(row);
    return { message: 'Alumno quitado del turno' };
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

  async teacherCanManageShift(token: string, userId: number, shift: ScheduleShift): Promise<boolean> {
    if (shift.moodleCourseId) {
      return this.moodleService.isTeacherInCourse(token, shift.moodleCourseId, userId);
    }
    const links = await this.linkRepo.find({ where: { folderId: shift.folderId } });
    if (!links.length) return false;
    for (const link of links) {
      if (await this.moodleService.isTeacherInCourse(token, link.moodleCourseId, userId)) {
        return true;
      }
    }
    return false;
  }

  async listTeacherShifts(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const shifts = await this.shiftRepo.find({
      where: { isActive: true },
      relations: ['folder'],
      order: { name: 'ASC' },
    });
    const out: ReturnType<CalendarService['serializeShift']>[] = [];
    for (const s of shifts) {
      if (await this.teacherCanManageShift(token, userId, s)) {
        out.push(this.serializeShift(s));
      }
    }
    return out;
  }

  async assertTeacherShift(token: string, shiftId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const shift = await this.getShiftOrFail(shiftId);
    if (!(await this.teacherCanManageShift(token, userId, shift))) {
      throw new ForbiddenException('No podés gestionar este turno');
    }
    return { userId, shift };
  }

  // ——— Student calendar ———

  private parseRange(from?: string, to?: string) {
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException('Parámetros from y to requeridos (YYYY-MM-DD)');
    }
    if (from > to) throw new BadRequestException('from debe ser <= to');
    return { from, to };
  }

  async getMyOccurrences(token: string, from?: string, to?: string): Promise<CalendarOccurrence[]> {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const range = this.parseRange(from, to);

    const enrollments = await this.enrollmentRepo.find({
      where: { moodleUserId: userId },
      relations: ['shift', 'shift.folder'],
    });

    const activeShifts = enrollments
      .map((e) => e.shift)
      .filter((s): s is ScheduleShift => Boolean(s?.isActive));

    const occurrences: CalendarOccurrence[] = [];

    for (const shift of activeShifts) {
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
          from: range.from,
          to: range.to,
        }),
      );
    }

    const shiftIds = activeShifts.map((s) => s.id);
    if (shiftIds.length) {
      const fromDate = new Date(`${range.from}T00:00:00.000Z`);
      const toDate = new Date(`${range.to}T23:59:59.999Z`);
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
    return occurrences.map((o) => ({
      ...o,
      googleUrl: googleCalendarTemplateUrl(o),
    })) as CalendarOccurrence[];
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
