import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { CoursesModule } from './courses/courses.module';
import { ExamsModule } from './exams/exams.module';
import { FilesModule } from './files/files.module';
import { ForumsModule } from './forums/forums.module';
import { LessonsModule } from './lessons/lessons.module';
import { MicrolearningModule } from './microlearning/microlearning.module';
import { MoodleModule } from './moodle/moodle.module';
import { ProgressModule } from './progress/progress.module';
import { RecordingsModule } from './recordings/recordings.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 90_000, // 90s — evita pegarle a Moodle en cada render
      max: 200,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const password = config.get<string>('DB_PASS');
        if (!password) {
          throw new Error('DB_PASS is required. Set it in .env');
        }
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5433),
          username: config.get<string>('DB_USER', 'postgres'),
          password,
          database: config.get<string>('DB_NAME', 'plataforma_ingles'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          // Solo auto-sync si DB_SYNC=true (default true en local para MVP)
          synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
        };
      },
      inject: [ConfigService],
    }),
    ExamsModule,
    MoodleModule,
    CoursesModule,
    UsersModule,
    AuthModule,
    TasksModule,
    LessonsModule,
    FilesModule,
    ForumsModule,
    ProgressModule,
    MicrolearningModule,
    AttendanceModule,
    RecordingsModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
