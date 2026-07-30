import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { CalendarService } from './calendar.service';
import {
  CreateCalendarEventDto,
  CreateShiftDto,
  EnrollDto,
  UpdateCalendarEventDto,
  UpdateShiftDto,
} from './dto/calendar.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // ——— Admin ———

  @UseGuards(AdminGuard)
  @Get('admin/shifts')
  adminListShifts() {
    return this.calendarService.adminListShifts();
  }

  @UseGuards(AdminGuard)
  @Post('admin/shifts')
  adminCreateShift(@Body() body: CreateShiftDto) {
    return this.calendarService.adminCreateShift(body);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/shifts/:id')
  adminUpdateShift(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateShiftDto) {
    return this.calendarService.adminUpdateShift(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/shifts/:id')
  adminDeleteShift(@Param('id', ParseIntPipe) id: number) {
    return this.calendarService.adminDeleteShift(id);
  }

  @UseGuards(AdminGuard)
  @Get('admin/shifts/:id/enrollments')
  adminListEnrollments(@Param('id', ParseIntPipe) id: number) {
    return this.calendarService.listEnrollments(id);
  }

  @UseGuards(AdminGuard)
  @Post('admin/shifts/:id/enrollments')
  adminEnroll(@Param('id', ParseIntPipe) id: number, @Body() body: EnrollDto) {
    return this.calendarService.enroll(id, body, null);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/shifts/:id/enrollments/:moodleUserId')
  adminUnenroll(
    @Param('id', ParseIntPipe) id: number,
    @Param('moodleUserId', ParseIntPipe) moodleUserId: number,
  ) {
    return this.calendarService.unenroll(id, moodleUserId);
  }

  @UseGuards(AdminGuard)
  @Get('admin/shifts/:id/teachers')
  adminListTeachers(@Param('id', ParseIntPipe) id: number) {
    return this.calendarService.listTeachers(id);
  }

  @UseGuards(AdminGuard)
  @Post('admin/shifts/:id/teachers')
  adminAssignTeacher(@Param('id', ParseIntPipe) id: number, @Body() body: EnrollDto) {
    return this.calendarService.assignTeacher(id, body, null);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/shifts/:id/teachers/:moodleUserId')
  adminUnassignTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Param('moodleUserId', ParseIntPipe) moodleUserId: number,
  ) {
    return this.calendarService.unassignTeacher(id, moodleUserId);
  }

  @UseGuards(AdminGuard)
  @Get('admin/events')
  adminListEvents(@Query('shiftId') shiftId?: string) {
    const id = shiftId ? parseInt(shiftId, 10) : undefined;
    return this.calendarService.adminListEvents(id && !Number.isNaN(id) ? id : undefined);
  }

  @UseGuards(AdminGuard)
  @Post('admin/events')
  adminCreateEvent(@Body() body: CreateCalendarEventDto) {
    return this.calendarService.createEvent(body);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/events/:id')
  adminUpdateEvent(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCalendarEventDto) {
    return this.calendarService.updateEvent(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/events/:id')
  adminDeleteEvent(@Param('id', ParseIntPipe) id: number) {
    return this.calendarService.deleteEvent(id);
  }

  // ——— Teacher ———

  @UseGuards(MoodleAuthGuard)
  @Get('teacher/shifts')
  async teacherShifts(@CurrentUser() user: MoodleUser) {
    return this.calendarService.listTeacherShifts(user.token);
  }

  @UseGuards(MoodleAuthGuard)
  @Get('teacher/today')
  async teacherToday(@CurrentUser() user: MoodleUser) {
    return this.calendarService.getTeacherToday(user.token);
  }

  @UseGuards(MoodleAuthGuard)
  @Post('teacher/events')
  async teacherCreateEvent(
    @CurrentUser() user: MoodleUser,
    @Body() body: CreateCalendarEventDto,
  ) {
    await this.calendarService.assertTeacherShift(user.token, body.shiftId);
    return this.calendarService.createEvent(body);
  }

  @UseGuards(MoodleAuthGuard)
  @Patch('teacher/events/:id')
  async teacherUpdateEvent(
    @CurrentUser() user: MoodleUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCalendarEventDto,
  ) {
    const existing = await this.calendarService.getEventOrFail(id);
    await this.calendarService.assertTeacherShift(user.token, existing.shiftId);
    if (body.shiftId != null && body.shiftId !== existing.shiftId) {
      await this.calendarService.assertTeacherShift(user.token, body.shiftId);
    }
    return this.calendarService.updateEvent(id, body);
  }

  @UseGuards(MoodleAuthGuard)
  @Delete('teacher/events/:id')
  async teacherDeleteEvent(
    @CurrentUser() user: MoodleUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const existing = await this.calendarService.getEventOrFail(id);
    await this.calendarService.assertTeacherShift(user.token, existing.shiftId);
    return this.calendarService.deleteEvent(id);
  }

  // ——— Student ———

  @UseGuards(MoodleAuthGuard)
  @Get('me')
  async myCalendar(
    @CurrentUser() user: MoodleUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendarService.getMyOccurrences(user.token, from, to);
  }

  @UseGuards(MoodleAuthGuard)
  @Get('me/ics')
  async myIcs(
    @CurrentUser() user: MoodleUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const ics = await this.calendarService.getMyIcs(user.token, from, to);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hopee-calendar.ics"');
    res.send(ics);
  }
}
