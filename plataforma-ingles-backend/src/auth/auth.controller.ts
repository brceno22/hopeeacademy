import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import {
  ADMIN_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_TTL_MS,
  AdminSessionService,
} from './admin-session.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { MoodleAuthGuard } from './moodle-auth.guard';
import type { MoodleUser } from './moodle-user.types';
import { AuthService } from './auth.service';
import { AdminSessionDto } from './dto/admin-session.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminSession: AdminSessionService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('admin/session')
  @HttpCode(HttpStatus.OK)
  createAdminSession(@Body() body: AdminSessionDto, @Res({ passthrough: true }) res: Response) {
    if (!this.adminSession.verifyAdminKey(body.key)) {
      throw new UnauthorizedException('Acceso denegado');
    }

    const { token, csrfToken, expiresAt } = this.adminSession.issueSession();

    res.cookie(ADMIN_COOKIE, token, this.cookieOptions(true));
    // Legible por JS a propósito: el front la reenvía en el header x-admin-csrf.
    res.cookie(ADMIN_CSRF_COOKIE, csrfToken, this.cookieOptions(false));

    return { authenticated: true, expiresAt };
  }

  @Get('admin/session')
  adminSessionStatus(@Req() req: Request) {
    const cookies = (req.cookies || {}) as Record<string, string | undefined>;
    const payload = this.adminSession.verifySession(cookies[ADMIN_COOKIE]);
    return { authenticated: true, expiresAt: payload.exp };
  }

  @Delete('admin/session')
  @HttpCode(HttpStatus.OK)
  destroyAdminSession(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE, this.cookieOptions(true));
    res.clearCookie(ADMIN_CSRF_COOKIE, this.cookieOptions(false));
    return { authenticated: false };
  }

  /**
   * En producción se asume HTTPS. Same-origin (Caddy + nginx, CORS vacío) usa
   * Lax. `SameSite=None` sólo si hay CORS cruzado. En dev el front pasa por el
   * proxy de Vite para quedar same-origin (ver vite.config.ts).
   */
  private cookieOptions(httpOnly: boolean): CookieOptions {
    const isProd = process.env.NODE_ENV === 'production';
    const crossOrigin =
      (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean).length > 0;
    return {
      httpOnly,
      secure: isProd,
      sameSite: isProd && crossOrigin ? 'none' : 'lax',
      maxAge: ADMIN_SESSION_TTL_MS,
      path: '/',
    };
  }
}
