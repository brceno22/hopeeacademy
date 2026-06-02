import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CoursesCatalogService } from './courses-catalog.service';
import { MoodleModule } from 'src/moodle/moodle.module';
import { LessonsModule } from 'src/lessons/lessons.module';
import { TasksModule } from 'src/tasks/tasks.module';
import { CourseFolder } from './entities/course-folder.entity';
import { CourseFolderLink } from './entities/course-folder-link.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseFolder, CourseFolderLink]),
    MoodleModule,
    TasksModule,
    LessonsModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesCatalogService],
  exports: [CoursesService, CoursesCatalogService],
})
export class CoursesModule {}
