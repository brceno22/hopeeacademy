import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MoodleModule } from '../moodle/moodle.module';
import { UserProfilePrefs } from './user-profile-prefs.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MoodleModule,
    AuthModule,
    TypeOrmModule.forFeature([UserProfilePrefs]),
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 5,
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
