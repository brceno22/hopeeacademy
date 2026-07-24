import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoodleModule } from '../moodle/moodle.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 5,
    }),
    MoodleModule,
  ],
  providers: [AuthService, AdminGuard],
  controllers: [AuthController],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
