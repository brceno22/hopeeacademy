import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const ADMIN_COOKIE = 'hopee_admin';
export const ADMIN_CSRF_COOKIE = 'hopee_admin_csrf';
export const ADMIN_CSRF_HEADER = 'x-admin-csrf';

/** 2 h: suficiente para una sesión de trabajo, corto para un token robado. */
export const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const MIN_SIGNING_SECRET_LENGTH = 32;
const MIN_ADMIN_KEY_LENGTH = 16;

interface AdminSessionPayload {
  exp: number;
  nonce: string;
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/** Compara hashes de igual longitud para no filtrar información por timing. */
function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

@Injectable()
export class AdminSessionService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Se valida en cada uso en lugar de en el constructor para que un deploy sin
   * la variable falle con un 500 explícito y no arranque en un estado inseguro.
   */
  private getSigningSecret(): string {
    const secret = this.config.get<string>('ADMIN_SESSION_SECRET');
    if (!secret || secret.length < MIN_SIGNING_SECRET_LENGTH) {
      throw new Error(
        `ADMIN_SESSION_SECRET is required and must be at least ${MIN_SIGNING_SECRET_LENGTH} characters`,
      );
    }
    return secret;
  }

  private getAdminSecret(): string {
    const secret = this.config.get<string>('ADMIN_SECRET');
    if (!secret || secret.length < MIN_ADMIN_KEY_LENGTH) {
      throw new Error(
        `ADMIN_SECRET is required and must be at least ${MIN_ADMIN_KEY_LENGTH} characters`,
      );
    }
    return secret;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.getSigningSecret()).update(body).digest('base64url');
  }

  /** Valida la clave de acceso del panel admin. */
  verifyAdminKey(key: unknown): boolean {
    if (typeof key !== 'string' || !key) return false;
    return constantTimeEquals(key, this.getAdminSecret());
  }

  /** Token stateless: payload en base64url + HMAC. No necesita tabla. */
  issueSession(): { token: string; csrfToken: string; expiresAt: number } {
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    const payload: AdminSessionPayload = {
      exp: expiresAt,
      nonce: randomBytes(16).toString('base64url'),
    };
    const body = b64urlEncode(JSON.stringify(payload));
    return {
      token: `${body}.${this.sign(body)}`,
      csrfToken: randomBytes(32).toString('base64url'),
      expiresAt,
    };
  }

  /** Lanza UnauthorizedException si la firma no valida o la sesión expiró. */
  verifySession(token: unknown): AdminSessionPayload {
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Acceso denegado');
    }

    const separator = token.lastIndexOf('.');
    if (separator <= 0) {
      throw new UnauthorizedException('Acceso denegado');
    }

    const body = token.slice(0, separator);
    const signature = token.slice(separator + 1);

    if (!constantTimeEquals(signature, this.sign(body))) {
      throw new UnauthorizedException('Acceso denegado');
    }

    let payload: AdminSessionPayload;
    try {
      payload = JSON.parse(b64urlDecode(body)) as AdminSessionPayload;
    } catch {
      throw new UnauthorizedException('Acceso denegado');
    }

    if (typeof payload?.exp !== 'number' || payload.exp <= Date.now()) {
      throw new UnauthorizedException('Sesión de admin expirada');
    }

    return payload;
  }

  verifyCsrf(cookieToken: unknown, headerToken: unknown): boolean {
    if (typeof cookieToken !== 'string' || !cookieToken) return false;
    if (typeof headerToken !== 'string' || !headerToken) return false;
    return constantTimeEquals(cookieToken, headerToken);
  }
}
