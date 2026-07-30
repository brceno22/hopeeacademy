import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceSessionDto, MarkAttendanceDto } from './dto/attendance.dto';

@Controller('attendance')
@UseGuards(MoodleAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('me')
  async getMyHistory(@CurrentUser() user: MoodleUser) {
    return this.attendanceService.getMyHistory(user.token);
  }

  @Get('teacher/shifts')
  async getTeacherShifts(@CurrentUser() user: MoodleUser) {
    return this.attendanceService.getTeacherShifts(user.token);
  }

  @Get('teacher/sessions')
  async listTeacherSessions(
    @CurrentUser() user: MoodleUser,
    @Query('shiftId', ParseIntPipe) shiftId: number,
  ) {
    return this.attendanceService.listTeacherSessions(user.token, shiftId);
  }

  @Post('sessions')
  async createSession(
    @CurrentUser() user: MoodleUser,
    @Body() body: CreateAttendanceSessionDto,
  ) {
    return this.attendanceService.createOrGetSession(user.token, body);
  }

  @Patch('sessions/:id/open')
  async openSession(
    @CurrentUser() user: MoodleUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.attendanceService.openSession(user.token, id);
  }

  @Patch('sessions/:id/close')
  async closeSession(
    @CurrentUser() user: MoodleUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.attendanceService.closeSession(user.token, id);
  }

  @Get('sessions/:id')
  async getRoster(
    @CurrentUser() user: MoodleUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.attendanceService.getSessionRoster(user.token, id);
  }

  @Patch('sessions/:id/roster/:moodleUserId')
  async markAttendance(
    @CurrentUser() user: MoodleUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('moodleUserId', ParseIntPipe) moodleUserId: number,
    @Body() body: MarkAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(user.token, id, moodleUserId, body);
  }
}
