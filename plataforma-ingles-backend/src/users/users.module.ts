import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoodleModule } from 'src/moodle/moodle.module';
import { UserProfilePrefs } from './user-profile-prefs.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MoodleModule,
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
