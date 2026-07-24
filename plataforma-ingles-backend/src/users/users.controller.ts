import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extractBearerToken } from '../auth/auth-token.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdatePrefsDto } from './dto/update-prefs.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.usersService.getMe(token);
  }

  @Patch('me')
  updateProfile(
    @Headers('authorization') authHeader: string,
    @Body() body: UpdateProfileDto,
  ) {
    const token = extractBearerToken(authHeader);
    return this.usersService.updateProfile(token, body.firstname, body.lastname);
  }

  @Patch('me/prefs')
  updatePrefs(
    @Headers('authorization') authHeader: string,
    @Body() body: UpdatePrefsDto,
  ) {
    const token = extractBearerToken(authHeader);
    return this.usersService.updatePrefs(token, body.avatarColor);
  }

  @Patch('me/password')
  changePassword(
    @Headers('authorization') authHeader: string,
    @Body() body: ChangePasswordDto,
  ) {
    const token = extractBearerToken(authHeader);
    return this.usersService.changePassword(token, body.currentPassword, body.newPassword);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  updateAvatar(
    @Headers('authorization') authHeader: string,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const token = extractBearerToken(authHeader);
    if (!file) {
      throw new BadRequestException('Image file is required (field name: file)');
    }
    return this.usersService.updateAvatar(token, file);
  }

  @Delete('me/avatar')
  deleteAvatar(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.usersService.deleteAvatar(token);
  }

  @Get('buscar')
  findOne(
    @Query('email') email?: string,
    @Query('username') username?: string,
  ) {
    if (email) return this.usersService.findOneByEmail(email);
    if (username) return this.usersService.findOneByUsername(username);
    return { error: 'Provide ?email= or ?username=' };
  }
}
