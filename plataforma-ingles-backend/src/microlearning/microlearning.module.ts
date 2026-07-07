import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MicrolearningContent } from './microlearning-content.entity';
import { UserMicrolearningHistory } from './user-microlearning-history.entity';
import { UserStreak } from './user-streak.entity';
import { MoodleModule } from '../moodle/moodle.module'; // Ajustá la ruta si es necesario
import { MicrolearningController } from './microlearning.controller';
import { MicrolearningService } from './microlearning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MicrolearningContent,
      UserMicrolearningHistory,
      UserStreak,
    ]),
    MoodleModule,
  ],
  controllers: [MicrolearningController],
  providers: [MicrolearningService],
})
export class MicrolearningModule {}