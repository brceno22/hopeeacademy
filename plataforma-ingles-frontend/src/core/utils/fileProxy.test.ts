import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/core/api/axios';
import {
  cleanMoodleFileUrl,
  fetchFileProxyUrl,
  fetchFileProxyUrls,
} from '@/core/utils/fileProxy';

vi.mock('@/core/api/axios', () => ({
  default: { post: vi.fn() },
  API_BASE_URL: '/api',
}));

const post = vi.mocked(api.post);

/** Responde con un ticket derivado de cada URL pedida. */
function ticketsFor(urls: string[]) {
  return {
    data: {
      tickets: Object.fromEntries(urls.map((url, i) => [url, `ticket-${i}`])),
    },
  };
}

beforeEach(() => {
  post.mockReset();
});

describe('cleanMoodleFileUrl', () => {
  it('rewrites the webservice pluginfile path to the public one', () => {
    expect(
      cleanMoodleFileUrl('https://moodle.example.com/webservice/pluginfile.php/1/a.pdf'),
    ).toBe('https://moodle.example.com/pluginfile.php/1/a.pdf');
  });

  it('drops forcedownload whether it is the first or a later query param', () => {
    expect(cleanMoodleFileUrl('https://m.example.com/a.pdf?forcedownload=1')).toBe(
      'https://m.example.com/a.pdf',
    );
    expect(cleanMoodleFileUrl('https://m.example.com/a.pdf?x=1&forcedownload=1')).toBe(
      'https://m.example.com/a.pdf?x=1',
    );
  });

  it('leaves an already clean url untouched', () => {
    const url = 'https://moodle.example.com/pluginfile.php/1/a.pdf';
    expect(cleanMoodleFileUrl(url)).toBe(url);
  });
});

describe('fetchFileProxyUrls', () => {
  it('maps each url to a proxy url carrying only the opaque ticket', async () => {
    const url = 'https://moodle.example.com/pluginfile.php/1/a.pdf';
    post.mockResolvedValue(ticketsFor([url]));

    const result = await fetchFileProxyUrls([url]);

    expect(result.get(url)).toBe('/api/files/proxy?ticket=ticket-0');
  });

  it('never puts the source url or a Moodle token in the proxy url', async () => {
    const url = 'https://moodle.example.com/pluginfile.php/1/a.pdf?token=super-secret';
    post.mockResolvedValue(ticketsFor([url]));

    const proxied = (await fetchFileProxyUrls([url])).get(url);

    expect(proxied).not.toContain('super-secret');
    expect(proxied).not.toContain('moodle.example.com');
  });

  it('percent-encodes the ticket so it survives the query string', async () => {
    const url = 'https://moodle.example.com/a.pdf';
    post.mockResolvedValue({ data: { tickets: { [url]: 'a+b/c=' } } });

    expect((await fetchFileProxyUrls([url])).get(url)).toBe(
      '/api/files/proxy?ticket=a%2Bb%2Fc%3D',
    );
  });

  it('asks for each url only once, even if the page repeats it', async () => {
    const url = 'https://moodle.example.com/a.pdf';
    post.mockResolvedValue(ticketsFor([url]));

    await fetchFileProxyUrls([url, url, url]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/files/tickets', { urls: [url] });
  });

  it('filters out empty urls before calling the backend', async () => {
    const url = 'https://moodle.example.com/a.pdf';
    post.mockResolvedValue(ticketsFor([url]));

    await fetchFileProxyUrls(['', url]);

    expect(post).toHaveBeenCalledWith('/files/tickets', { urls: [url] });
  });

  it('makes no request at all when there is nothing to resolve', async () => {
    const result = await fetchFileProxyUrls(['', '']);

    expect(result.size).toBe(0);
    expect(post).not.toHaveBeenCalled();
  });

  it('splits into batches of 50, the cap the backend DTO enforces', async () => {
    const urls = Array.from({ length: 120 }, (_, i) => `https://m.example.com/${i}.pdf`);
    post.mockImplementation((_url, body) =>
      Promise.resolve(ticketsFor((body as { urls: string[] }).urls)),
    );

    const result = await fetchFileProxyUrls(urls);

    expect(post).toHaveBeenCalledTimes(3);
    const batchSizes = post.mock.calls.map((call) => (call[1] as { urls: string[] }).urls.length);
    expect(batchSizes).toEqual([50, 50, 20]);
    expect(result.size).toBe(120);
  });

  it('tolerates a response without a tickets object', async () => {
    post.mockResolvedValue({ data: {} });

    await expect(fetchFileProxyUrls(['https://m.example.com/a.pdf'])).resolves.toEqual(new Map());
  });
});

describe('fetchFileProxyUrl', () => {
  it('returns the proxy url for a single file', async () => {
    const url = 'https://moodle.example.com/a.pdf';
    post.mockResolvedValue(ticketsFor([url]));

    await expect(fetchFileProxyUrl(url)).resolves.toBe('/api/files/proxy?ticket=ticket-0');
  });

  it('returns null when the backend refuses to issue a ticket', async () => {
    post.mockResolvedValue({ data: { tickets: {} } });

    await expect(fetchFileProxyUrl('https://moodle.example.com/a.pdf')).resolves.toBeNull();
  });
});
