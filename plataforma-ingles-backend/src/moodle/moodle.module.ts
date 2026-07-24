import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoodleService } from './moodle.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 5,
    }),
  ],
  providers: [MoodleService],
  exports: [MoodleService],
})
export class MoodleModule {}
