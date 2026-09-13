import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { MoodleUser } from '../moodle-user.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MoodleUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    // MoodleAuthGuard corre antes y siempre deja request.user seteado.
    return request.user as MoodleUser;
  },
);
