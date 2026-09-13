import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MoodleClientService } from './moodle-client.service';
import { MoodleParams } from './moodle.types';

const SEARCH_CACHE_TTL_MS = 60_000;
const SEARCH_FIELDS = ['firstname', 'lastname', 'email', 'username'] as const;

export type MoodleDirectoryUser = {
  id: number;
  fullname: string;
  email: string;
  username: string;
};

@Injectable()
export class MoodleUsersService {
  private readonly logger = new Logger(MoodleUsersService.name);

  constructor(
    private readonly client: MoodleClientService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Lookup Moodle users by id (admin token or user token). */
  async getUsersByIds(
    userIds: number[],
    userToken?: string,
  ): Promise<
    Array<{
      id: number;
      fullname?: string;
      firstname?: string;
      lastname?: string;
      email?: string;
      username?: string;
    }>
  > {
    if (!userIds.length) return [];
    const params: MoodleParams = { field: 'id' };
    userIds.forEach((id, i) => {
      params[`values[${i}]`] = id;
    });
    const data = await this.client.request<
      Array<Record<string, unknown>> | { users?: Array<Record<string, unknown>> }
    >('core_user_get_users_by_field', params, userToken);

    const users = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];

    return users.map((u) => ({
      id: u.id as number,
      fullname:
        (u.fullname as string) ||
        `${(u.firstname as string) || ''} ${(u.lastname as string) || ''}`.trim() ||
        (u.username as string),
      firstname: u.firstname as string | undefined,
      lastname: u.lastname as string | undefined,
      email: u.email as string | undefined,
      username: u.username as string | undefined,
    }));
  }

  private mapMoodleUserRow(u: Record<string, unknown>): MoodleDirectoryUser | null {
    const id = Number(u.id);
    if (!Number.isFinite(id) || id < 1) return null;
    // Guest / deleted / suspended
    if (id === 1) return null;
    if (u.deleted === true || u.deleted === 1 || u.deleted === '1') return null;
    if (u.suspended === true || u.suspended === 1 || u.suspended === '1') return null;

    const firstname = (u.firstname as string) || '';
    const lastname = (u.lastname as string) || '';
    const fullname =
      (u.fullname as string) ||
      `${firstname} ${lastname}`.trim() ||
      (u.username as string) ||
      `User ${id}`;

    return {
      id,
      fullname,
      email: (u.email as string) || '',
      username: (u.username as string) || '',
    };
  }

  /**
   * Autocomplete admin: consulta Moodle con la query (no descarga el directorio).
   */
  async searchUsers(query: string, limit = 20): Promise<MoodleDirectoryUser[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const cacheKey = `moodle:users:search:${q.toLowerCase()}:${limit}`;
    const cached = await this.cache.get<MoodleDirectoryUser[]>(cacheKey);
    if (cached) return cached;

    const byId = new Map<number, MoodleDirectoryUser>();
    const wildcard = `%${q}%`;

    await Promise.all(
      SEARCH_FIELDS.map(async (key) => {
        try {
          const data = await this.client.request<{ users?: Array<Record<string, unknown>> }>(
            'core_user_get_users',
            {
              'criteria[0][key]': key,
              'criteria[0][value]': wildcard,
            },
          );
          for (const row of Array.isArray(data?.users) ? data.users : []) {
            const mapped = this.mapMoodleUserRow(row);
            if (mapped) byId.set(mapped.id, mapped);
          }
        } catch (err) {
          this.logger.warn(
            `searchUsers(${key}=${wildcard}) failed: ${(err as Error)?.message ?? err}`,
          );
        }
      }),
    );

    const needle = q.toLowerCase();
    const results = [...byId.values()]
      .filter((u) => `${u.fullname} ${u.email} ${u.username}`.toLowerCase().includes(needle))
      .sort((a, b) => a.fullname.localeCompare(b.fullname, 'es', { sensitivity: 'base' }))
      .slice(0, limit);

    await this.cache.set(cacheKey, results, SEARCH_CACHE_TTL_MS);
    return results;
  }
}
