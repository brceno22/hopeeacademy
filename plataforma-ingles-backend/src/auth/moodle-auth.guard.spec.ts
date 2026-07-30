import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MoodleAuthGuard } from './moodle-auth.guard';

describe('MoodleAuthGuard', () => {
  const moodleService = {
    getUserIdFromToken: jest.fn(),
  };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const guard = new MoodleAuthGuard(moodleService as any, cache as any);

  function mockContext(authHeader?: string) {
    const request: Record<string, unknown> = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getRequest: () => request,
    } as unknown as ExecutionContext & { getRequest: () => Record<string, unknown> };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
  });

  it('rejects missing Bearer token', async () => {
    await expect(guard.canActivate(mockContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid token from Moodle', async () => {
    moodleService.getUserIdFromToken.mockRejectedValue(new UnauthorizedException('invalid'));
    await expect(guard.canActivate(mockContext('Bearer bad'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches user when token is valid', async () => {
    moodleService.getUserIdFromToken.mockResolvedValue(42);
    const ctx = mockContext('Bearer good-token');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect(req.user).toEqual({ userId: 42, token: 'good-token' });
    expect(cache.set).toHaveBeenCalled();
  });

  it('uses cached userId without calling Moodle', async () => {
    cache.get.mockResolvedValue(7);
    const ctx = mockContext('Bearer cached-token');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(moodleService.getUserIdFromToken).not.toHaveBeenCalled();
    expect(ctx.switchToHttp().getRequest().user).toEqual({
      userId: 7,
      token: 'cached-token',
    });
  });
});
