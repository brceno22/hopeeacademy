import { Logger } from '@nestjs/common';

const logger = new Logger('Env');

const MIN_ADMIN_KEY_LENGTH = 16;
const RECOMMENDED_ADMIN_KEY_LENGTH = 32;
const MIN_SIGNING_SECRET_LENGTH = 32;
const PLACEHOLDER_RE = /cambia-esta/i;

function required(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} es obligatoria. Definila en .env`);
  }
  return value.trim();
}

function envString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function rejectPlaceholder(key: string, value: string, errors: string[]) {
  if (value && PLACEHOLDER_RE.test(value)) {
    errors.push(`${key} parece un valor de ejemplo; generá un secreto real`);
  }
}

/**
 * Caddy + nginx = 2 hops. `true` asume ese stack; un número fija los hops.
 */
export function parseTrustProxy(value: string | undefined): number | false {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw || raw === 'false' || raw === '0') return false;
  if (raw === 'true') return 2;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  return false;
}

/**
 * Valida el entorno al cargar ConfigModule. Falla con el nombre de la variable,
 * no con un stack de TypeORM tres módulos más tarde.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const nodeEnv = envString(config.NODE_ENV, envString(process.env.NODE_ENV));
  const isTest = nodeEnv === 'test';

  const requireKey = (key: string) => {
    try {
      return required(config, key);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      return '';
    }
  };

  const dbPass = requireKey('DB_PASS');
  rejectPlaceholder('DB_PASS', dbPass, errors);
  requireKey('MOODLE_URL');
  if (!isTest) {
    requireKey('MOODLE_TOKEN');
  }

  const adminSecret = requireKey('ADMIN_SECRET');
  rejectPlaceholder('ADMIN_SECRET', adminSecret, errors);
  if (adminSecret && adminSecret.length < MIN_ADMIN_KEY_LENGTH) {
    errors.push(
      `ADMIN_SECRET es obligatoria y debe tener al menos ${MIN_ADMIN_KEY_LENGTH} caracteres`,
    );
  } else if (adminSecret && adminSecret.length < RECOMMENDED_ADMIN_KEY_LENGTH) {
    logger.warn('ADMIN_SECRET tiene menos de 32 caracteres; conviene rotarla por una más larga');
  }

  const sessionSecret = requireKey('ADMIN_SESSION_SECRET');
  rejectPlaceholder('ADMIN_SESSION_SECRET', sessionSecret, errors);
  if (sessionSecret && sessionSecret.length < MIN_SIGNING_SECRET_LENGTH) {
    errors.push(
      `ADMIN_SESSION_SECRET es obligatoria y debe tener al menos ${MIN_SIGNING_SECRET_LENGTH} caracteres`,
    );
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return {
    ...config,
    PORT: config.PORT || '3003',
    DB_HOST: config.DB_HOST || 'localhost',
    DB_PORT: config.DB_PORT || '5433',
    DB_USER: config.DB_USER || 'postgres',
    DB_NAME: config.DB_NAME || 'plataforma_ingles',
    DB_SYNC: config.DB_SYNC || 'false',
    TRUST_PROXY: config.TRUST_PROXY || 'false',
    CORS_ORIGINS: config.CORS_ORIGINS || '',
    SWAGGER: config.SWAGGER || '',
  };
}

export function shouldEnableSwagger(): boolean {
  if (process.env.SWAGGER === 'true') return true;
  if (process.env.SWAGGER === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}
