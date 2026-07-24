import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { ClassRecording } from './class-recording.entity';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClassRecording, CourseFolder]),
    AuthModule,
  ],
  controllers: [RecordingsController],
  providers: [RecordingsService],
})
export class RecordingsModule {}
