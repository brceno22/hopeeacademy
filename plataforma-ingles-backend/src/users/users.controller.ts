import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdatePrefsDto } from './dto/update-prefs.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(MoodleAuthGuard)
  @Get('me')
  me(@CurrentUser() user: MoodleUser) {
    return this.usersService.getMe(user.token);
  }

  @UseGuards(MoodleAuthGuard)
  @Patch('me')
  updateProfile(@CurrentUser() user: MoodleUser, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(user.token, body.firstname, body.lastname);
  }

  @UseGuards(MoodleAuthGuard)
  @Patch('me/prefs')
  updatePrefs(@CurrentUser() user: MoodleUser, @Body() body: UpdatePrefsDto) {
    return this.usersService.updatePrefs(user.token, body.avatarColor);
  }

  @UseGuards(MoodleAuthGuard)
  @Patch('me/password')
  changePassword(@CurrentUser() user: MoodleUser, @Body() body: ChangePasswordDto) {
    return this.usersService.changePassword(user.token, body.currentPassword, body.newPassword);
  }

  @UseGuards(MoodleAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  updateAvatar(
    @CurrentUser() user: MoodleUser,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required (field name: file)');
    }
    return this.usersService.updateAvatar(user.token, file);
  }

  @UseGuards(MoodleAuthGuard)
  @Delete('me/avatar')
  deleteAvatar(@CurrentUser() user: MoodleUser) {
    return this.usersService.deleteAvatar(user.token);
  }

  @UseGuards(AdminGuard)
  @Get('buscar')
  findOne(@Query('email') email?: string, @Query('username') username?: string) {
    if (email) return this.usersService.findOneByEmail(email);
    if (username) return this.usersService.findOneByUsername(username);
    throw new BadRequestException('Provide ?email= or ?username=');
  }

  @UseGuards(AdminGuard)
  @Get('search')
  search(@Query('q') q?: string) {
    if (!q?.trim()) throw new BadRequestException('Provide ?q=');
    return this.usersService.searchUsers(q);
  }
}
