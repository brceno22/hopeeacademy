import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { MoodleAuthGuard } from './moodle-auth.guard';
import type { MoodleUser } from './moodle-user.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password);
  }

  @UseGuards(MoodleAuthGuard)
  @Get('capabilities')
  capabilities(@CurrentUser() user: MoodleUser) {
    return this.authService.getCapabilities(user.token, user.userId);
  }
}
