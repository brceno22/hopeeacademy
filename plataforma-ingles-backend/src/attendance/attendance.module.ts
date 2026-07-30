import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ScheduleShift } from '../calendar/schedule-shift.entity';
import { ShiftEnrollment } from '../calendar/shift-enrollment.entity';
import { MoodleModule } from '../moodle/moodle.module';
import { AttendanceCheckIn } from './attendance-checkin.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceSession } from './attendance-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceSession,
      AttendanceCheckIn,
      ScheduleShift,
      ShiftEnrollment,
    ]),
    MoodleModule,
    AuthModule,
    CalendarModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
