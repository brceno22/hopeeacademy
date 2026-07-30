import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { MoodleModule } from '../moodle/moodle.module';

@Module({
  imports: [MoodleModule, AuthModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
