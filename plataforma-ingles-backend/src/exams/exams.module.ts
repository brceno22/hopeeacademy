import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { Exam } from './entities/exam.entity';
import { Question } from './entities/question.entity';
import { Option } from './entities/option.entity';
import { Attempt } from './entities/attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Exam, Question, Option, Attempt])],
  providers: [ExamsService],
  controllers: [ExamsController]
})
export class ExamsModule {}
