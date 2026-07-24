import { UnauthorizedException } from '@nestjs/common';

/** Extrae el Bearer token del header Authorization. */
export function extractBearerToken(authHeader?: string): string {
  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) {
    throw new UnauthorizedException('Falta el token de autenticación (Authorization: Bearer …)');
  }
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

/** Token opcional: si no hay header, retorna undefined. */
export function extractOptionalBearerToken(authHeader?: string): string | undefined {
  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) {
    return undefined;
  }
  return authHeader.replace(/^Bearer\s+/i, '').trim() || undefined;
}
