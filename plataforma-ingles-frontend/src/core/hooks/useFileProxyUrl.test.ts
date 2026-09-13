import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileProxyUrl } from '@/core/hooks/useFileProxyUrl';
import { TICKET_REFRESH_MS, fetchFileProxyUrl } from '@/core/utils/fileProxy';

vi.mock('@/core/utils/fileProxy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/utils/fileProxy')>();
  return { ...actual, fetchFileProxyUrl: vi.fn() };
});

const fetchUrl = vi.mocked(fetchFileProxyUrl);

const MOODLE_URL = 'https://moodle.example.com/webservice/pluginfile.php/1/a.pdf';
const CLEAN_URL = 'https://moodle.example.com/pluginfile.php/1/a.pdf';

beforeEach(() => {
  fetchUrl.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFileProxyUrl', () => {
  it('starts loading and then exposes the resolved proxy url', async () => {
    fetchUrl.mockResolvedValue('/api/files/proxy?ticket=t1');

    const { result } = renderHook(() => useFileProxyUrl(MOODLE_URL));

    expect(result.current).toEqual({ url: null, loading: true, error: false });

    await waitFor(() => {
      expect(result.current).toEqual({
        url: '/api/files/proxy?ticket=t1',
        loading: false,
        error: false,
      });
    });
  });

  it('normalises the Moodle url before asking for a ticket', async () => {
    fetchUrl.mockResolvedValue('/api/files/proxy?ticket=t1');

    renderHook(() => useFileProxyUrl(MOODLE_URL));

    await waitFor(() => {
      expect(fetchUrl).toHaveBeenCalledWith(CLEAN_URL);
    });
  });

  it('reports an error when the backend refuses to issue a ticket', async () => {
    fetchUrl.mockResolvedValue(null);

    const { result } = renderHook(() => useFileProxyUrl(MOODLE_URL));

    await waitFor(() => {
      expect(result.current).toEqual({ url: null, loading: false, error: true });
    });
  });

  it('reports an error when the request itself fails', async () => {
    fetchUrl.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useFileProxyUrl(MOODLE_URL));

    await waitFor(() => {
      expect(result.current).toEqual({ url: null, loading: false, error: true });
    });
  });

  it.each([null, undefined, ''])('stays idle and issues no request for %p', async (value) => {
    const { result } = renderHook(() => useFileProxyUrl(value));

    expect(result.current).toEqual({ url: null, loading: false, error: false });
    expect(fetchUrl).not.toHaveBeenCalled();
  });

  it('goes back to loading when the file changes, without showing the stale url', async () => {
    fetchUrl.mockResolvedValue('/api/files/proxy?ticket=t1');

    const { result, rerender } = renderHook(({ url }) => useFileProxyUrl(url), {
      initialProps: { url: MOODLE_URL },
    });

    await waitFor(() => expect(result.current.url).toBe('/api/files/proxy?ticket=t1'));

    fetchUrl.mockResolvedValue('/api/files/proxy?ticket=t2');
    rerender({ url: 'https://moodle.example.com/pluginfile.php/1/b.pdf' });

    expect(result.current).toEqual({ url: null, loading: true, error: false });

    await waitFor(() => expect(result.current.url).toBe('/api/files/proxy?ticket=t2'));
  });

  it('renews the ticket before it expires, so long previews do not break', async () => {
    vi.useFakeTimers();
    fetchUrl.mockResolvedValue('/api/files/proxy?ticket=t1');

    const { result } = renderHook(() => useFileProxyUrl(MOODLE_URL));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.url).toBe('/api/files/proxy?ticket=t1');

    fetchUrl.mockResolvedValue('/api/files/proxy?ticket=t2');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TICKET_REFRESH_MS);
    });

    expect(fetchUrl).toHaveBeenCalledTimes(2);
    expect(result.current.url).toBe('/api/files/proxy?ticket=t2');
  });

  it('stops renewing once the component unmounts', async () => {
    vi.useFakeTimers();
    fetchUrl.mockResolvedValue('/api/files/proxy?ticket=t1');

    const { unmount } = renderHook(() => useFileProxyUrl(MOODLE_URL));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TICKET_REFRESH_MS * 3);
    });

    expect(fetchUrl).toHaveBeenCalledTimes(1);
  });
});
