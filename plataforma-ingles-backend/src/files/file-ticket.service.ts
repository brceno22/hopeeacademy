import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/** Corto a propósito: el ticket viaja en la URL de un <img> o <iframe>. */
export const FILE_TICKET_TTL_MS = 5 * 60 * 1000;

export interface FileTicketData {
  fileUrl: string;
  userId: number;
  moodleToken: string;
}

/**
 * Tickets opacos guardados en caché en lugar de tokens en la query string.
 * El token de Moodle nunca sale del servidor.
 *
 * Con más de una instancia de la API esto necesita un store compartido
 * (Redis) en lugar de la caché en memoria.
 */
@Injectable()
export class FileTicketService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private key(ticket: string): string {
    return `file-ticket:${ticket}`;
  }

  async issue(data: FileTicketData): Promise<string> {
    const ticket = randomBytes(32).toString('base64url');
    await this.cache.set(this.key(ticket), data, FILE_TICKET_TTL_MS);
    return ticket;
  }

  async resolve(ticket: unknown): Promise<FileTicketData | null> {
    if (typeof ticket !== 'string' || !ticket) return null;
    const found = await this.cache.get<FileTicketData>(this.key(ticket));
    return found ?? null;
  }
}
