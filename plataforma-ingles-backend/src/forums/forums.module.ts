import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';
import { MoodleModule } from '../moodle/moodle.module';

@Module({
  imports: [MoodleModule, AuthModule],
  controllers: [ForumsController],
  providers: [ForumsService],
})
export class ForumsModule {}
