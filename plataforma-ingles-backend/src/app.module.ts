import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoodleModule } from './moodle/moodle.module';
import { CoursesModule } from './courses/courses.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { LessonsModule } from './lessons/lessons.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsModule } from './exams/exams.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'plataforma'),
        password: config.get('DB_PASS', 'plataforma123'),
        database: config.get('DB_NAME', 'plataforma_ingles'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    ExamsModule,
    MoodleModule,
    CoursesModule,
    UsersModule,
    AuthModule,
    TasksModule,
    LessonsModule,
    ExamsModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}