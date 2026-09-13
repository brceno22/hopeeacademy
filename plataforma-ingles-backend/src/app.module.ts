import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { HealthModule } from './health/health.module';
import { LessonsModule } from './lessons/lessons.module';
import { MicrolearningModule } from './microlearning/microlearning.module';
import { MoodleModule } from './moodle/moodle.module';
import { ProgressModule } from './progress/progress.module';
import { RecordingsModule } from './recordings/recordings.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { validateEnv } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 90_000, // 90s — evita pegarle a Moodle en cada render
      max: 500,
    }),
    // Default amplio; las rutas sensibles lo bajan con @Throttle.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: Number(config.get('DB_PORT')) || 5433,
          username: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASS') as string,
          database: config.get<string>('DB_NAME', 'plataforma_ingles'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          // Solo auto-sync si DB_SYNC=true (default false — usar migrations)
          synchronize: config.get<string>('DB_SYNC', 'false') === 'true',
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: false,
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
    HealthModule,
    ProgressModule,
    MicrolearningModule,
    AttendanceModule,
    RecordingsModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
