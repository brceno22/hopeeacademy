import { parseTrustProxy, validateEnv } from './env';

const validProd = {
  NODE_ENV: 'production',
  DB_PASS: 'real-db-password-not-example',
  MOODLE_URL: 'https://moodle.example.com',
  MOODLE_TOKEN: 'moodle-ws-token',
  ADMIN_SECRET: 'a-real-admin-secret-32chars-min',
  ADMIN_SESSION_SECRET: 'a-real-session-secret-32-chars-min-ok',
};

describe('validateEnv', () => {
  it('accepts a complete production config', () => {
    expect(validateEnv(validProd).PORT).toBe('3003');
  });

  it('requires MOODLE_TOKEN outside test', () => {
    expect(() => validateEnv({ ...validProd, MOODLE_TOKEN: '' })).toThrow(/MOODLE_TOKEN/);
  });

  it('does not require MOODLE_TOKEN in test', () => {
    expect(() => validateEnv({ ...validProd, NODE_ENV: 'test', MOODLE_TOKEN: '' })).not.toThrow();
  });

  it('rejects placeholder ADMIN_SECRET values from .env.example', () => {
    expect(() =>
      validateEnv({ ...validProd, ADMIN_SECRET: 'cambia-esta-clave-de-admin-32chars' }),
    ).toThrow(/ADMIN_SECRET/);
  });

  it('rejects placeholder ADMIN_SESSION_SECRET values', () => {
    expect(() =>
      validateEnv({
        ...validProd,
        ADMIN_SESSION_SECRET: 'cambia-esta-firma-hmac-de-sesion-32chars',
      }),
    ).toThrow(/ADMIN_SESSION_SECRET/);
  });

  it('rejects placeholder DB_PASS values', () => {
    expect(() => validateEnv({ ...validProd, DB_PASS: 'cambia-esta-clave' })).toThrow(/DB_PASS/);
  });
});

describe('parseTrustProxy', () => {
  it('treats true as two hops (Caddy + nginx)', () => {
    expect(parseTrustProxy('true')).toBe(2);
  });

  it('parses a hop count', () => {
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('1')).toBe(1);
  });

  it('disables trust when unset or false', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });
});
