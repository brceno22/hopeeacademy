import type { Cache } from 'cache-manager';
import { FILE_TICKET_TTL_MS, FileTicketService } from './file-ticket.service';

/** Caché en memoria con expiración simulada, para no depender del reloj real. */
function makeCache() {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  let now = 0;

  const cache = {
    set: jest.fn(async (key: string, value: unknown, ttl?: number) => {
      store.set(key, { value, expiresAt: now + (ttl ?? 0) });
    }),
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    }),
  } as unknown as Cache;

  return { cache, advance: (ms: number) => (now += ms), store };
}

describe('FileTicketService', () => {
  const data = {
    fileUrl: 'https://moodle.example.com/pluginfile.php/1/mod_resource/content/0/a.pdf',
    userId: 42,
    moodleToken: 'user-token',
  };

  it('resolves a freshly issued ticket', async () => {
    const { cache } = makeCache();
    const service = new FileTicketService(cache);

    const ticket = await service.issue(data);
    await expect(service.resolve(ticket)).resolves.toEqual(data);
  });

  it('issues opaque tickets that do not contain the Moodle token', async () => {
    const { cache } = makeCache();
    const service = new FileTicketService(cache);

    const ticket = await service.issue(data);
    expect(ticket).not.toContain(data.moodleToken);
    expect(ticket).not.toContain(data.fileUrl);
  });

  it('issues a different ticket every time', async () => {
    const { cache } = makeCache();
    const service = new FileTicketService(cache);

    const first = await service.issue(data);
    const second = await service.issue(data);
    expect(first).not.toEqual(second);
  });

  it('returns null for an expired ticket', async () => {
    const { cache, advance } = makeCache();
    const service = new FileTicketService(cache);

    const ticket = await service.issue(data);
    advance(FILE_TICKET_TTL_MS + 1);
    await expect(service.resolve(ticket)).resolves.toBeNull();
  });

  it('returns null for an unknown or malformed ticket', async () => {
    const { cache } = makeCache();
    const service = new FileTicketService(cache);

    await expect(service.resolve('does-not-exist')).resolves.toBeNull();
    await expect(service.resolve('')).resolves.toBeNull();
    await expect(service.resolve(undefined)).resolves.toBeNull();
    await expect(service.resolve(null)).resolves.toBeNull();
    await expect(service.resolve(123)).resolves.toBeNull();
  });

  it('namespaces cache keys so tickets cannot collide with other cached data', async () => {
    const { cache, store } = makeCache();
    const service = new FileTicketService(cache);

    const ticket = await service.issue(data);
    expect([...store.keys()]).toEqual([`file-ticket:${ticket}`]);
  });
});
