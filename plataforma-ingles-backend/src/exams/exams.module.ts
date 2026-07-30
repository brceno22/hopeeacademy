import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CalendarModule } from '../calendar/calendar.module';
import { CoursesModule } from '../courses/courses.module';
import { MoodleModule } from '../moodle/moodle.module';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { Exam } from './entities/exam.entity';
import { Question } from './entities/question.entity';
import { Option } from './entities/option.entity';
import { Attempt } from './entities/attempt.entity';
import { ExamMediaService } from './exam-media.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exam, Question, Option, Attempt]),
    AuthModule,
    CoursesModule,
    CalendarModule,
    MoodleModule,
  ],
  providers: [ExamsService, ExamMediaService],
  controllers: [ExamsController],
})
export class ExamsModule {}
