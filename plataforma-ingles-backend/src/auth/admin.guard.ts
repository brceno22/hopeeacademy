import { createHash, timingSafeEqual } from 'crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.config.get<string>('ADMIN_SECRET');
    if (!expectedKey) {
      throw new UnauthorizedException('Acceso denegado');
    }

    const request = context.switchToHttp().getRequest();
    const adminKey = request.headers['x-admin-key'];
    if (typeof adminKey !== 'string' || !adminKey) {
      throw new UnauthorizedException('Acceso denegado');
    }

    const a = createHash('sha256').update(adminKey).digest();
    const b = createHash('sha256').update(expectedKey).digest();
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Acceso denegado');
    }
    return true;
  }
}
