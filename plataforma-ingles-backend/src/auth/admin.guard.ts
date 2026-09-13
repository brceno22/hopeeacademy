import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  ADMIN_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  AdminSessionService,
} from './admin-session.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminSession: AdminSessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookies = (request.cookies || {}) as Record<string, string | undefined>;

    this.adminSession.verifySession(cookies[ADMIN_COOKIE]);

    // Al autenticar por cookie el navegador la adjunta sola, así que los
    // métodos que mutan estado necesitan double-submit para frenar CSRF.
    if (MUTATING_METHODS.has(request.method)) {
      const ok = this.adminSession.verifyCsrf(
        cookies[ADMIN_CSRF_COOKIE],
        request.headers[ADMIN_CSRF_HEADER],
      );
      if (!ok) {
        throw new UnauthorizedException('Token CSRF inválido o ausente');
      }
    }

    return true;
  }
}
