import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoodleModule } from '../moodle/moodle.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './admin.guard';
import { MoodleAuthGuard } from './moodle-auth.guard';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 5,
    }),
    MoodleModule,
  ],
  providers: [AuthService, AdminGuard, MoodleAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, AdminGuard, MoodleAuthGuard, MoodleModule],
})
export class AuthModule {}
