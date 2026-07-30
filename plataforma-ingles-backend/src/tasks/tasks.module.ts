import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { MoodleModule } from '../moodle/moodle.module';

@Module({
  imports: [MoodleModule, AuthModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
