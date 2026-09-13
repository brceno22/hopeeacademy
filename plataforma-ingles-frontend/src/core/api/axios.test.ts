import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import api, { API_BASE_URL, clearStudentStorage } from '@/core/api/axios';

/**
 * Se reemplaza el adapter en lugar de mockear axios: así corre la cadena real
 * de interceptores y se puede inspeccionar la request que habría salido.
 */
let lastConfig: InternalAxiosRequestConfig | null = null;
let nextStatus = 200;

beforeEach(() => {
  lastConfig = null;
  nextStatus = 200;

  api.defaults.adapter = (config) => {
    lastConfig = config;
    const response: AxiosResponse = {
      data: {},
      status: nextStatus,
      statusText: 'OK',
      headers: {},
      config,
    };
    return nextStatus >= 400
      ? Promise.reject(Object.assign(new Error('request failed'), { config, response }))
      : Promise.resolve(response);
  };
});

function header(name: string): unknown {
  return lastConfig?.headers?.[name];
}

describe('api instance', () => {
  it('defaults to the Vite proxy path so the admin cookie stays same-origin', () => {
    expect(API_BASE_URL).toBe('/api');
    expect(api.defaults.baseURL).toBe('/api');
  });

  it('sends credentials, otherwise the admin session cookie would be dropped', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });
});

describe('Authorization header', () => {
  it('attaches the stored Moodle token as a Bearer header', async () => {
    localStorage.setItem('token', 'moodle-token');

    await api.get('/progress/global');

    expect(header('Authorization')).toBe('Bearer moodle-token');
  });

  it('sends no Authorization header when there is no stored token', async () => {
    await api.get('/progress/global');

    expect(header('Authorization')).toBeUndefined();
  });
});

describe('CSRF double-submit header', () => {
  it('echoes the CSRF cookie on POST', async () => {
    document.cookie = 'hopee_admin_csrf=csrf-value; path=/';

    await api.post('/exams', {});

    expect(header('x-admin-csrf')).toBe('csrf-value');
  });

  it.each(['put', 'patch', 'delete'] as const)('echoes the CSRF cookie on %s', async (method) => {
    document.cookie = 'hopee_admin_csrf=csrf-value; path=/';

    await api.request({ url: '/exams/1', method });

    expect(header('x-admin-csrf')).toBe('csrf-value');
  });

  it('does not send the CSRF header on GET, which the backend does not check', async () => {
    document.cookie = 'hopee_admin_csrf=csrf-value; path=/';

    await api.get('/exams');

    expect(header('x-admin-csrf')).toBeUndefined();
  });

  it('sends no CSRF header when the cookie is absent', async () => {
    await api.post('/exams', {});

    expect(header('x-admin-csrf')).toBeUndefined();
  });

  it('decodes a percent-encoded cookie value before echoing it', async () => {
    document.cookie = `hopee_admin_csrf=${encodeURIComponent('a+b/c=')}; path=/`;

    await api.post('/exams', {});

    expect(header('x-admin-csrf')).toBe('a+b/c=');
  });

  it('picks the right cookie when others are present', async () => {
    document.cookie = 'other=1; path=/';
    document.cookie = 'hopee_admin_csrf=csrf-value; path=/';
    document.cookie = 'hopee_admin_csrf_extra=wrong; path=/';

    await api.post('/exams', {});

    expect(header('x-admin-csrf')).toBe('csrf-value');
  });
});

describe('401 handling', () => {
  it('keeps the student session on a 401 from the login endpoint', async () => {
    localStorage.setItem('token', 'moodle-token');
    nextStatus = 401;

    await expect(api.post('/auth/login', {})).rejects.toThrow();

    expect(localStorage.getItem('token')).toBe('moodle-token');
  });

  it('keeps the student session on a 401 from the admin session endpoint', async () => {
    localStorage.setItem('token', 'moodle-token');
    nextStatus = 401;

    await expect(api.get('/auth/admin/session')).rejects.toThrow();

    expect(localStorage.getItem('token')).toBe('moodle-token');
  });

  it('does not touch storage on a 401 when there is no student session', async () => {
    nextStatus = 401;

    await expect(api.get('/exams/mine')).rejects.toThrow();

    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('clearStudentStorage', () => {
  it('removes every student key but leaves unrelated ones alone', () => {
    localStorage.setItem('token', 't');
    localStorage.setItem('moodleUserId', '7');
    localStorage.setItem('fullName', 'Ana');
    localStorage.setItem('avatarUrl', 'a.png');
    localStorage.setItem('avatarColor', '#fff');
    localStorage.setItem('unrelated', 'keep-me');

    clearStudentStorage();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('moodleUserId')).toBeNull();
    expect(localStorage.getItem('fullName')).toBeNull();
    expect(localStorage.getItem('avatarUrl')).toBeNull();
    expect(localStorage.getItem('avatarColor')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep-me');
  });
});
