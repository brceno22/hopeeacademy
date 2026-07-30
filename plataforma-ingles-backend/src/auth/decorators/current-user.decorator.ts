import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MoodleUser } from '../moodle-user.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MoodleUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as MoodleUser;
  },
);
