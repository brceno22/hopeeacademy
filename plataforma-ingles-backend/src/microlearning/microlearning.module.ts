import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MoodleModule } from '../moodle/moodle.module';
import { MicrolearningContent } from './microlearning-content.entity';
import { MicrolearningController } from './microlearning.controller';
import { MicrolearningService } from './microlearning.service';
import { UserMicrolearningHistory } from './user-microlearning-history.entity';
import { UserStreak } from './user-streak.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MicrolearningContent,
      UserMicrolearningHistory,
      UserStreak,
    ]),
    MoodleModule,
    AuthModule,
  ],
  controllers: [MicrolearningController],
  providers: [MicrolearningService],
})
export class MicrolearningModule {}
