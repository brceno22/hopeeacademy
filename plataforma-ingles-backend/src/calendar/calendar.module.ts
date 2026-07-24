import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { CourseFolderLink } from '../courses/entities/course-folder-link.entity';
import { MoodleModule } from '../moodle/moodle.module';
import { CalendarEvent } from './calendar-event.entity';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { ScheduleShift } from './schedule-shift.entity';
import { ShiftEnrollment } from './shift-enrollment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleShift,
      ShiftEnrollment,
      CalendarEvent,
      CourseFolder,
      CourseFolderLink,
    ]),
    MoodleModule,
    AuthModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
