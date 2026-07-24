import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { extractBearerToken } from '../auth/auth-token.util';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceSessionDto } from './dto/attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('open')
  async getOpenSessions(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.getOpenSessionsForStudent(token);
  }

  @Get('me')
  async getMyHistory(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.getMyHistory(token);
  }

  @Get('teacher/courses')
  async getTeacherCourses(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.getTeacherCourses(token);
  }

  @Get('teacher/sessions')
  async listTeacherSessions(
    @Headers('authorization') authHeader: string,
    @Query('courseId', ParseIntPipe) courseId: number,
  ) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.listTeacherSessions(token, courseId);
  }

  @Post('sessions')
  async createSession(
    @Headers('authorization') authHeader: string,
    @Body() body: CreateAttendanceSessionDto,
  ) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.createOrGetSession(token, body);
  }

  @Patch('sessions/:id/open')
  async openSession(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.openSession(token, id);
  }

  @Patch('sessions/:id/close')
  async closeSession(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.closeSession(token, id);
  }

  @Get('sessions/:id')
  async getRoster(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.getSessionRoster(token, id);
  }

  @Post('sessions/:id/check-in')
  async checkIn(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const token = extractBearerToken(authHeader);
    return this.attendanceService.checkIn(token, id);
  }
}
