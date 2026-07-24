import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoodleModule } from '../moodle/moodle.module';
import { AttendanceCheckIn } from './attendance-checkin.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceSession } from './attendance-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceSession, AttendanceCheckIn]),
    MoodleModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
