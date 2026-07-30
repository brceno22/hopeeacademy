import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ScheduleShift } from '../calendar/schedule-shift.entity';
import { ShiftEnrollment } from '../calendar/shift-enrollment.entity';
import { ShiftTeacher } from '../calendar/shift-teacher.entity';
import { LessonsModule } from '../lessons/lessons.module';
import { MoodleModule } from '../moodle/moodle.module';
import { TasksModule } from '../tasks/tasks.module';
import { CoursesCatalogService } from './courses-catalog.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseFolder } from './entities/course-folder.entity';
import { CourseFolderLink } from './entities/course-folder-link.entity';
import { ProgramEnrollmentSyncService } from './program-enrollment-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseFolder,
      CourseFolderLink,
      ScheduleShift,
      ShiftEnrollment,
      ShiftTeacher,
    ]),
    MoodleModule,
    TasksModule,
    LessonsModule,
    AuthModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesCatalogService, ProgramEnrollmentSyncService],
  exports: [CoursesService, CoursesCatalogService, ProgramEnrollmentSyncService],
})
export class CoursesModule {}
