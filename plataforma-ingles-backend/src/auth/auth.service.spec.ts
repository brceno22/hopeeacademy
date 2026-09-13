import { HttpService } from '@nestjs/axios';
import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { MoodleService } from '../moodle/moodle.service';
import { AuthService } from './auth.service';

const MOODLE_URL = 'https://moodle.example.com/webservice/rest/server.php';
const TOKEN_URL = 'https://moodle.example.com/login/token.php';

interface Harness {
  service: AuthService;
  http: { post: jest.Mock; get: jest.Mock };
  moodle: {
    getUserIdFromToken: jest.Mock;
    getUserCourses: jest.Mock;
    isTeacherInCourse: jest.Mock;
  };
  store: Map<string, unknown>;
}

function makeHarness(env: Record<string, string | undefined> = {}): Harness {
  const config = {
    MOODLE_URL,
    MOODLE_SERVICE: 'hopee',
    MOODLE_TOKEN: 'service-token',
    ...env,
  };

  const http = { post: jest.fn(), get: jest.fn() };
  const moodle = {
    getUserIdFromToken: jest.fn(),
    getUserCourses: jest.fn(),
    isTeacherInCourse: jest.fn(),
  };

  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  } as unknown as Cache;

  const configService = {
    get: (key: string) => config[key],
  } as unknown as ConfigService;

  const service = new AuthService(
    http as unknown as HttpService,
    configService,
    moodle as unknown as MoodleService,
    cache,
  );

  return { service, http, moodle, store };
}

/** Respuesta de core_webservice_get_site_info tras un login exitoso. */
function siteInfoOk() {
  return of({ data: { userid: 7, fullname: 'Ana Gómez' } });
}

describe('AuthService', () => {
  describe('login', () => {
    it('fails fast when MOODLE_URL is not configured', async () => {
      const { service, http } = makeHarness({ MOODLE_URL: undefined });

      await expect(service.login('ana', 'secret')).rejects.toBeInstanceOf(BadGatewayException);
      expect(http.post).not.toHaveBeenCalled();
    });

    it('returns the Moodle token, userId and full name on success', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(of({ data: { token: 'user-token' } }));
      http.get.mockReturnValue(siteInfoOk());

      await expect(service.login('ana', 'secret')).resolves.toEqual({
        message: 'Login exitoso',
        moodleToken: 'user-token',
        userId: 7,
        fullName: 'Ana Gómez',
      });

      // token.php, no el endpoint REST
      expect(http.post).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.stringContaining('username=ana'),
        expect.anything(),
      );
    });

    it('maps invalidlogin to a 401 that tells the user to use their Moodle username', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(
        of({ data: { error: 'Invalid login', errorcode: 'invalidlogin' } }),
      );

      await expect(service.login('ana', 'wrong')).rejects.toMatchObject({
        status: 401,
        message: expect.stringContaining('username'),
      });
    });

    it('maps disabled web services to a 502 instead of a credentials error', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(of({ data: { errorcode: 'enablewsdescription' } }));

      await expect(service.login('ana', 'secret')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('maps a missing external service to a 502', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(of({ data: { errorcode: 'servicenotavailable' } }));

      await expect(service.login('ana', 'secret')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('maps a missing createtoken capability to a 401', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(of({ data: { errorcode: 'cannotcreatetoken' } }));

      await expect(service.login('ana', 'secret')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when Moodle answers without a token and without an error code', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(of({ data: {} }));

      await expect(service.login('ana', 'secret')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when Moodle returns a token but no userid in site info', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(of({ data: { token: 'user-token' } }));
      http.get.mockReturnValue(of({ data: {} }));

      await expect(service.login('ana', 'secret')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('reports an unreachable Moodle as a 502, not as bad credentials', async () => {
      const { service, http } = makeHarness();
      http.post.mockReturnValue(throwError(() => ({ code: 'ECONNREFUSED' })));

      await expect(service.login('ana', 'secret')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('resolves an email to the real username before calling token.php', async () => {
      const { service, http } = makeHarness();
      // Primer get: core_user_get_users_by_field. Segundo: site info.
      http.get
        .mockReturnValueOnce(of({ data: [{ username: 'ana' }] }))
        .mockReturnValueOnce(siteInfoOk());
      http.post.mockReturnValue(of({ data: { token: 'user-token' } }));

      await expect(service.login('ana@example.com', 'secret')).resolves.toMatchObject({
        userId: 7,
      });

      const lookupUrl = http.get.mock.calls[0][0] as string;
      expect(lookupUrl).toContain('core_user_get_users_by_field');
      expect(lookupUrl).toContain('field=email');

      expect(http.post).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.stringContaining('username=ana&'),
        expect.anything(),
      );
    });

    it('falls back to the raw input when the email lookup fails', async () => {
      const { service, http } = makeHarness();
      http.get
        .mockReturnValueOnce(throwError(() => new Error('moodle down')))
        .mockReturnValueOnce(siteInfoOk());
      http.post.mockReturnValue(of({ data: { token: 'user-token' } }));

      await expect(service.login('ana@example.com', 'secret')).resolves.toMatchObject({
        userId: 7,
      });

      expect(http.post).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.stringContaining(encodeURIComponent('ana@example.com')),
        expect.anything(),
      );
    });

    it('skips the email lookup when no service token is configured', async () => {
      const { service, http } = makeHarness({ MOODLE_TOKEN: undefined });
      http.post.mockReturnValue(of({ data: { token: 'user-token' } }));
      http.get.mockReturnValue(siteInfoOk());

      await service.login('ana@example.com', 'secret');

      // Solo la llamada de site info: no hubo resolución de email.
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCapabilities', () => {
    it('reports a teacher when the user teaches at least one course', async () => {
      const { service, moodle } = makeHarness();
      moodle.getUserCourses.mockResolvedValue([{ id: 10 }, { id: 11 }]);
      moodle.isTeacherInCourse.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(service.getCapabilities('user-token', 7)).resolves.toEqual({
        isTeacher: true,
      });
    });

    it('stops checking courses as soon as one teaching role is found', async () => {
      const { service, moodle } = makeHarness();
      moodle.getUserCourses.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]);
      moodle.isTeacherInCourse.mockResolvedValue(true);

      await service.getCapabilities('user-token', 7);

      expect(moodle.isTeacherInCourse).toHaveBeenCalledTimes(1);
    });

    it('reports a student when no course has a teaching role', async () => {
      const { service, moodle } = makeHarness();
      moodle.getUserCourses.mockResolvedValue([{ id: 10 }]);
      moodle.isTeacherInCourse.mockResolvedValue(false);

      await expect(service.getCapabilities('user-token', 7)).resolves.toEqual({
        isTeacher: false,
      });
    });

    it('resolves the userId from the token when it is not supplied', async () => {
      const { service, moodle } = makeHarness();
      moodle.getUserIdFromToken.mockResolvedValue(99);
      moodle.getUserCourses.mockResolvedValue([]);

      await service.getCapabilities('user-token');

      expect(moodle.getUserIdFromToken).toHaveBeenCalledWith('user-token');
      expect(moodle.getUserCourses).toHaveBeenCalledWith('user-token', 99);
    });

    it('serves the cached result without querying Moodle again', async () => {
      const { service, moodle } = makeHarness();
      moodle.getUserCourses.mockResolvedValue([{ id: 10 }]);
      moodle.isTeacherInCourse.mockResolvedValue(true);

      await service.getCapabilities('user-token', 7);
      await expect(service.getCapabilities('user-token', 7)).resolves.toEqual({
        isTeacher: true,
      });

      expect(moodle.getUserCourses).toHaveBeenCalledTimes(1);
    });

    it('caches per user, so one teacher does not grant rights to another user', async () => {
      const { service, moodle, store } = makeHarness();
      moodle.getUserCourses.mockResolvedValue([{ id: 10 }]);
      moodle.isTeacherInCourse.mockResolvedValue(true);

      await service.getCapabilities('teacher-token', 7);

      expect([...store.keys()]).toEqual(['auth:capabilities:7']);
    });
  });
});
