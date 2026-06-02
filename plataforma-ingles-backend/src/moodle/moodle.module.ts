import { Module } from '@nestjs/common';
import { MoodleService } from './moodle.service';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { HttpModule } from '@nestjs/axios/dist/http.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
  ],
  providers: [MoodleService],
  exports: [MoodleService],
})
export class MoodleModule {}
