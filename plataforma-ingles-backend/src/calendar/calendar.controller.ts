import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { extractBearerToken } from '../auth/auth-token.util';
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

  @Get('teacher/shifts')
  async teacherShifts(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.calendarService.listTeacherShifts(token);
  }

  @Get('teacher/shifts/:id/enrollments')
  async teacherListEnrollments(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const token = extractBearerToken(authHeader);
    await this.calendarService.assertTeacherShift(token, id);
    return this.calendarService.listEnrollments(id);
  }

  @Post('teacher/shifts/:id/enrollments')
  async teacherEnroll(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EnrollDto,
  ) {
    const token = extractBearerToken(authHeader);
    const { userId } = await this.calendarService.assertTeacherShift(token, id);
    return this.calendarService.enroll(id, body, userId);
  }

  @Delete('teacher/shifts/:id/enrollments/:moodleUserId')
  async teacherUnenroll(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('moodleUserId', ParseIntPipe) moodleUserId: number,
  ) {
    const token = extractBearerToken(authHeader);
    await this.calendarService.assertTeacherShift(token, id);
    return this.calendarService.unenroll(id, moodleUserId);
  }

  @Post('teacher/events')
  async teacherCreateEvent(
    @Headers('authorization') authHeader: string,
    @Body() body: CreateCalendarEventDto,
  ) {
    const token = extractBearerToken(authHeader);
    await this.calendarService.assertTeacherShift(token, body.shiftId);
    return this.calendarService.createEvent(body);
  }

  @Patch('teacher/events/:id')
  async teacherUpdateEvent(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCalendarEventDto,
  ) {
    const token = extractBearerToken(authHeader);
    const existing = await this.calendarService.getEventOrFail(id);
    await this.calendarService.assertTeacherShift(token, existing.shiftId);
    return this.calendarService.updateEvent(id, body);
  }

  @Delete('teacher/events/:id')
  async teacherDeleteEvent(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const token = extractBearerToken(authHeader);
    const existing = await this.calendarService.getEventOrFail(id);
    await this.calendarService.assertTeacherShift(token, existing.shiftId);
    return this.calendarService.deleteEvent(id);
  }

  // ——— Student ———

  @Get('me')
  async myCalendar(
    @Headers('authorization') authHeader: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const token = extractBearerToken(authHeader);
    return this.calendarService.getMyOccurrences(token, from, to);
  }

  @Get('me/ics')
  async myIcs(
    @Headers('authorization') authHeader: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const token = extractBearerToken(authHeader);
    const ics = await this.calendarService.getMyIcs(token, from, to);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hopee-calendar.ics"');
    res.send(ics);
  }
}
