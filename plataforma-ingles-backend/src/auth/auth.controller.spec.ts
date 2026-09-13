import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import {
  ADMIN_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_TTL_MS,
  AdminSessionService,
} from './admin-session.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { MoodleUser } from './moodle-user.types';

const ADMIN_SECRET = 'admin-key-con-largo-suficiente';
const SESSION_SECRET = 'session-secret-de-mas-de-32-caracteres-ok';

interface SetCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Response mínimo que registra las cookies emitidas: lo que se quiere fijar por
 * test son los flags (httpOnly / secure / sameSite), no el transporte HTTP.
 */
function makeResponse() {
  const cookies: SetCookie[] = [];
  const cleared: SetCookie[] = [];

  const res = {
    cookie: (name: string, value: string, options: CookieOptions) => {
      cookies.push({ name, value, options });
      return res;
    },
    clearCookie: (name: string, options: CookieOptions) => {
      cleared.push({ name, value: '', options });
      return res;
    },
  } as unknown as Response;

  return {
    res,
    cookies,
    cleared,
    find: (name: string) => cookies.find((c) => c.name === name),
    findCleared: (name: string) => cleared.find((c) => c.name === name),
  };
}

function makeRequest(cookies: Record<string, string | undefined> = {}) {
  return { cookies } as unknown as Request;
}

function makeHarness() {
  const authService = {
    login: jest.fn(),
    getCapabilities: jest.fn(),
  };

  const config = {
    get: (key: string) => ({ ADMIN_SECRET, ADMIN_SESSION_SECRET: SESSION_SECRET })[key],
  } as unknown as ConfigService;

  // Servicio real: así el test cubre también la firma HMAC de la sesión.
  const adminSession = new AdminSessionService(config);
  const controller = new AuthController(authService as unknown as AuthService, adminSession);

  return { controller, authService, adminSession };
}

describe('AuthController', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCors = process.env.CORS_ORIGINS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalCors === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCors;
    }
  });

  describe('login', () => {
    it('delegates to AuthService with the submitted credentials', async () => {
      const { controller, authService } = makeHarness();
      authService.login.mockResolvedValue({ moodleToken: 'user-token' });

      await expect(controller.login({ username: 'ana', password: 'secret' })).resolves.toEqual({
        moodleToken: 'user-token',
      });

      expect(authService.login).toHaveBeenCalledWith('ana', 'secret');
    });
  });

  describe('capabilities', () => {
    it('passes the caller token and userId, never values from the body', async () => {
      const { controller, authService } = makeHarness();
      authService.getCapabilities.mockResolvedValue({ isTeacher: false });
      const user: MoodleUser = { userId: 7, token: 'user-token' };

      await controller.capabilities(user);

      expect(authService.getCapabilities).toHaveBeenCalledWith('user-token', 7);
    });
  });

  describe('POST admin/session', () => {
    it('rejects a wrong admin key without issuing any cookie', () => {
      const { controller } = makeHarness();
      const { res, cookies } = makeResponse();

      expect(() => controller.createAdminSession({ key: 'wrong' }, res)).toThrow(
        UnauthorizedException,
      );
      expect(cookies).toHaveLength(0);
    });

    it('issues the session cookie as HttpOnly so JavaScript cannot read it', () => {
      const { controller } = makeHarness();
      const { res, find } = makeResponse();

      controller.createAdminSession({ key: ADMIN_SECRET }, res);

      const session = find(ADMIN_COOKIE);
      expect(session?.options.httpOnly).toBe(true);
      expect(session?.options.path).toBe('/');
      expect(session?.options.maxAge).toBe(ADMIN_SESSION_TTL_MS);
    });

    it('issues the CSRF cookie readable by JavaScript, so the front can echo it', () => {
      const { controller } = makeHarness();
      const { res, find } = makeResponse();

      controller.createAdminSession({ key: ADMIN_SECRET }, res);

      expect(find(ADMIN_CSRF_COOKIE)?.options.httpOnly).toBe(false);
    });

    it('never puts the admin key itself in a cookie', () => {
      const { controller } = makeHarness();
      const { res, cookies } = makeResponse();

      controller.createAdminSession({ key: ADMIN_SECRET }, res);

      expect(cookies).toHaveLength(2);
      for (const cookie of cookies) {
        expect(cookie.value).not.toContain(ADMIN_SECRET);
      }
    });

    it('issues a session cookie that the service accepts back', () => {
      const { controller, adminSession } = makeHarness();
      const { res, find } = makeResponse();

      const result = controller.createAdminSession({ key: ADMIN_SECRET }, res);

      const token = find(ADMIN_COOKIE)?.value;
      expect(adminSession.verifySession(token).exp).toBe(result.expiresAt);
      expect(result.authenticated).toBe(true);
    });

    it('uses secure SameSite=Lax cookies in production when CORS is empty (same-origin)', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGINS;
      const { controller } = makeHarness();
      const { res, cookies } = makeResponse();

      controller.createAdminSession({ key: ADMIN_SECRET }, res);

      for (const cookie of cookies) {
        expect(cookie.options.secure).toBe(true);
        expect(cookie.options.sameSite).toBe('lax');
      }
    });

    it('uses SameSite=None cookies in production when CORS is cross-origin', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGINS = 'https://app.example.com';
      const { controller } = makeHarness();
      const { res, cookies } = makeResponse();

      controller.createAdminSession({ key: ADMIN_SECRET }, res);

      for (const cookie of cookies) {
        expect(cookie.options.secure).toBe(true);
        expect(cookie.options.sameSite).toBe('none');
      }
    });

    it('relaxes to SameSite=Lax outside production, where there is no HTTPS', () => {
      process.env.NODE_ENV = 'development';
      const { controller } = makeHarness();
      const { res, cookies } = makeResponse();

      controller.createAdminSession({ key: ADMIN_SECRET }, res);

      for (const cookie of cookies) {
        expect(cookie.options.secure).toBe(false);
        expect(cookie.options.sameSite).toBe('lax');
      }
    });
  });

  describe('GET admin/session', () => {
    it('confirms a valid session cookie', () => {
      const { controller, adminSession } = makeHarness();
      const { token, expiresAt } = adminSession.issueSession();

      expect(controller.adminSessionStatus(makeRequest({ [ADMIN_COOKIE]: token }))).toEqual({
        authenticated: true,
        expiresAt,
      });
    });

    it('rejects a missing or tampered session cookie', () => {
      const { controller, adminSession } = makeHarness();
      const { token } = adminSession.issueSession();

      expect(() => controller.adminSessionStatus(makeRequest())).toThrow(UnauthorizedException);
      expect(() =>
        controller.adminSessionStatus(makeRequest({ [ADMIN_COOKIE]: `${token}x` })),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('DELETE admin/session', () => {
    it('clears both cookies with the same flags used to set them', () => {
      const { controller } = makeHarness();
      const { res, cleared, findCleared } = makeResponse();

      expect(controller.destroyAdminSession(res)).toEqual({ authenticated: false });

      expect(cleared).toHaveLength(2);
      expect(findCleared(ADMIN_COOKIE)?.options.httpOnly).toBe(true);
      expect(findCleared(ADMIN_CSRF_COOKIE)?.options.httpOnly).toBe(false);
    });
  });
});
