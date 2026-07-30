import { createHash } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MoodleService } from '../moodle/moodle.service';
import { extractBearerToken } from './auth-token.util';
import type { MoodleUser } from './moodle-user.types';

const USER_CACHE_TTL_MS = 90_000;

@Injectable()
export class MoodleAuthGuard implements CanActivate {
  constructor(
    private readonly moodleService: MoodleService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers?.authorization);

    const cacheKey = `moodle:user:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;
    let userId = await this.cache.get<number>(cacheKey);

    if (!userId) {
      userId = await this.moodleService.getUserIdFromToken(token);
      await this.cache.set(cacheKey, userId, USER_CACHE_TTL_MS);
    }

    if (!userId) {
      throw new UnauthorizedException('Token de Moodle inválido o expirado');
    }

    const user: MoodleUser = { userId, token };
    request.user = user;
    return true;
  }
}
