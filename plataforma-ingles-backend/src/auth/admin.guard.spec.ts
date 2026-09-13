import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADMIN_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_TTL_MS,
  AdminSessionService,
} from './admin-session.service';
import { AdminGuard } from './admin.guard';

const ADMIN_SECRET = 'a'.repeat(40);
const SESSION_SECRET = 'b'.repeat(40);

function makeContext(options: {
  method?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): ExecutionContext {
  const request = {
    method: options.method ?? 'GET',
    cookies: options.cookies ?? {},
    headers: options.headers ?? {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ADMIN_SECRET') return ADMIN_SECRET;
      if (key === 'ADMIN_SESSION_SECRET') return SESSION_SECRET;
      return undefined;
    }),
  } as unknown as ConfigService;

  const adminSession = new AdminSessionService(config);
  const guard = new AdminGuard(adminSession);

  it('allows a GET with a valid session cookie', () => {
    const { token } = adminSession.issueSession();
    expect(guard.canActivate(makeContext({ cookies: { [ADMIN_COOKIE]: token } }))).toBe(true);
  });

  it('rejects a request without a session cookie', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects a tampered signature', () => {
    const { token } = adminSession.issueSession();
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(() => guard.canActivate(makeContext({ cookies: { [ADMIN_COOKIE]: tampered } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with a different secret', () => {
    const otherConfig = {
      get: jest.fn((key: string) =>
        key === 'ADMIN_SESSION_SECRET' ? 'c'.repeat(40) : ADMIN_SECRET,
      ),
    } as unknown as ConfigService;
    const { token } = new AdminSessionService(otherConfig).issueSession();

    expect(() => guard.canActivate(makeContext({ cookies: { [ADMIN_COOKIE]: token } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired session', () => {
    const realNow = Date.now;
    Date.now = () => realNow() - ADMIN_SESSION_TTL_MS - 1000;
    const { token } = adminSession.issueSession();
    Date.now = realNow;

    expect(() => guard.canActivate(makeContext({ cookies: { [ADMIN_COOKIE]: token } }))).toThrow(
      UnauthorizedException,
    );
  });

  describe('CSRF double-submit', () => {
    it('allows a POST when the header matches the cookie', () => {
      const { token, csrfToken } = adminSession.issueSession();
      const context = makeContext({
        method: 'POST',
        cookies: { [ADMIN_COOKIE]: token, [ADMIN_CSRF_COOKIE]: csrfToken },
        headers: { 'x-admin-csrf': csrfToken },
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('rejects a POST without the CSRF header', () => {
      const { token, csrfToken } = adminSession.issueSession();
      const context = makeContext({
        method: 'POST',
        cookies: { [ADMIN_COOKIE]: token, [ADMIN_CSRF_COOKIE]: csrfToken },
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('rejects a DELETE when the header does not match the cookie', () => {
      const { token, csrfToken } = adminSession.issueSession();
      const context = makeContext({
        method: 'DELETE',
        cookies: { [ADMIN_COOKIE]: token, [ADMIN_CSRF_COOKIE]: csrfToken },
        headers: { 'x-admin-csrf': 'something-else' },
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('verifyAdminKey', () => {
    it('accepts the configured secret', () => {
      expect(adminSession.verifyAdminKey(ADMIN_SECRET)).toBe(true);
    });

    it('rejects a wrong or empty key', () => {
      expect(adminSession.verifyAdminKey('wrong')).toBe(false);
      expect(adminSession.verifyAdminKey('')).toBe(false);
      expect(adminSession.verifyAdminKey(undefined)).toBe(false);
    });
  });
});
