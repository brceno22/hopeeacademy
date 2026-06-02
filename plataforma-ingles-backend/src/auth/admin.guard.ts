import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminKey = request.headers['x-admin-key'];
    const expectedKey = this.config.get<string>('ADMIN_SECRET');

    if (!adminKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Acceso denegado');
    }
    return true;
  }
}