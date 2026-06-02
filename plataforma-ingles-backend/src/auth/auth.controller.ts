import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
    
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() body: Record<string, string>) {
      const { username, password } = body;
      return this.authService.login(username, password);
    }

  }

