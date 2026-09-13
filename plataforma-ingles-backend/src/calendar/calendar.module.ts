import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { CoursesModule } from '../courses/courses.module';
import { MoodleModule } from '../moodle/moodle.module';
import { CalendarEvent } from './calendar-event.entity';
import { CalendarController } from './calendar.controller';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarService } from './calendar.service';
import { ScheduleShift } from './schedule-shift.entity';
import { ShiftAdminService } from './shift-admin.service';
import { ShiftEnrollment } from './shift-enrollment.entity';
import { ShiftRosterService } from './shift-roster.service';
import { ShiftTeacher } from './shift-teacher.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleShift,
      ShiftEnrollment,
      ShiftTeacher,
      CalendarEvent,
      CourseFolder,
    ]),
    MoodleModule,
    AuthModule,
    CoursesModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService, ShiftAdminService, ShiftRosterService, CalendarEventsService],
  exports: [CalendarService],
})
export class CalendarModule {}
