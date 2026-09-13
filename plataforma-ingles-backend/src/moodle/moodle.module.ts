import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoodleClientService } from './moodle-client.service';
import { MoodleEnrolmentService } from './moodle-enrolment.service';
import { MoodleService } from './moodle.service';
import { MoodleUsersService } from './moodle-users.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 5,
    }),
  ],
  providers: [MoodleClientService, MoodleUsersService, MoodleEnrolmentService, MoodleService],
  exports: [MoodleService],
})
export class MoodleModule {}
