import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserProgress } from './user-progress.entity';
import { MoodleModule } from '../moodle/moodle.module';
import { CoursesModule } from '../courses/courses.module';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProgress]),
    MoodleModule,
    CoursesModule,
    AuthModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
