import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { extractBearerToken } from './auth-token.util';
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

  @Get('capabilities')
  capabilities(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.authService.getCapabilities(token);
  }
}
