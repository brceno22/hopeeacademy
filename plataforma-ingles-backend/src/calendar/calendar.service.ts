import { Injectable } from '@nestjs/common';
import { CalendarEventsService } from './calendar-events.service';
import {
  CreateCalendarEventDto,
  CreateShiftDto,
  EnrollDto,
  UpdateCalendarEventDto,
  UpdateShiftDto,
} from './dto/calendar.dto';
import { ScheduleShift } from './schedule-shift.entity';
import { ShiftAdminService } from './shift-admin.service';
import { ShiftRosterService } from './shift-roster.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly shiftAdmin: ShiftAdminService,
    private readonly roster: ShiftRosterService,
    private readonly events: CalendarEventsService,
  ) {}

  adminListShifts() {
    return this.shiftAdmin.adminListShifts();
  }

  adminCreateShift(dto: CreateShiftDto) {
    return this.shiftAdmin.adminCreateShift(dto);
  }

  adminUpdateShift(id: number, dto: UpdateShiftDto) {
    return this.shiftAdmin.adminUpdateShift(id, dto);
  }

  adminDeleteShift(id: number) {
    return this.shiftAdmin.adminDeleteShift(id);
  }

  listEnrollments(shiftId: number) {
    return this.roster.listEnrollments(shiftId);
  }

  enroll(shiftId: number, dto: EnrollDto, assignedByUserId?: number | null) {
    return this.roster.enroll(shiftId, dto, assignedByUserId);
  }

  unenroll(shiftId: number, moodleUserId: number) {
    return this.roster.unenroll(shiftId, moodleUserId);
  }

  listTeachers(shiftId: number) {
    return this.roster.listTeachers(shiftId);
  }

  assignTeacher(shiftId: number, dto: EnrollDto, assignedByUserId?: number | null) {
    return this.roster.assignTeacher(shiftId, dto, assignedByUserId);
  }

  unassignTeacher(shiftId: number, moodleUserId: number) {
    return this.roster.unassignTeacher(shiftId, moodleUserId);
  }

  adminListEvents(shiftId?: number) {
    return this.events.adminListEvents(shiftId);
  }

  createEvent(dto: CreateCalendarEventDto) {
    return this.events.createEvent(dto);
  }

  getEventOrFail(id: number) {
    return this.events.getEventOrFail(id);
  }

  updateEvent(id: number, dto: UpdateCalendarEventDto) {
    return this.events.updateEvent(id, dto);
  }

  deleteEvent(id: number) {
    return this.events.deleteEvent(id);
  }

  teacherCanManageShift(token: string, userId: number, shift: ScheduleShift) {
    return this.shiftAdmin.teacherCanManageShift(token, userId, shift);
  }

  listTeacherShifts(token: string) {
    return this.shiftAdmin.listTeacherShifts(token);
  }

  assertTeacherShift(token: string, shiftId: number) {
    return this.shiftAdmin.assertTeacherShift(token, shiftId);
  }

  buildOccurrencesForShifts(shifts: ScheduleShift[], from: string, to: string) {
    return this.events.buildOccurrencesForShifts(shifts, from, to);
  }

  getMyOccurrences(token: string, from?: string, to?: string) {
    return this.events.getMyOccurrences(token, from, to);
  }

  getTeacherToday(token: string, now?: Date) {
    return this.events.getTeacherToday(token, now);
  }

  getMyIcs(token: string, from?: string, to?: string) {
    return this.events.getMyIcs(token, from, to);
  }
}
