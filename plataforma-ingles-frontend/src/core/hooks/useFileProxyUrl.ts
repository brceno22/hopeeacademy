import { useEffect, useState } from 'react';
import {
  TICKET_REFRESH_MS,
  cleanMoodleFileUrl,
  fetchFileProxyUrl,
} from '@/core/utils/fileProxy';

interface FileProxyUrlState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

interface Resolved {
  /** URL de origen, para descartar resultados de un fileUrl anterior. */
  key: string;
  url: string | null;
  error: boolean;
}

/**
 * Resuelve la URL del proxy para un archivo de Moodle y la renueva mientras el
 * recurso siga montado, porque los tickets expiran.
 */
export function useFileProxyUrl(fileUrl: string | null | undefined): FileProxyUrlState {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!fileUrl) return;

    let cancelled = false;
    const cleaned = cleanMoodleFileUrl(fileUrl);

    const resolve = async () => {
      try {
        const proxied = await fetchFileProxyUrl(cleaned);
        if (!cancelled) {
          setResolved({ key: fileUrl, url: proxied, error: proxied === null });
        }
      } catch {
        if (!cancelled) setResolved({ key: fileUrl, url: null, error: true });
      }
    };

    void resolve();

    const timer = window.setInterval(() => void resolve(), TICKET_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fileUrl]);

  // Derivado en lugar de un setState sincrónico en el efecto.
  if (!fileUrl) return { url: null, loading: false, error: false };
  if (resolved?.key !== fileUrl) return { url: null, loading: true, error: false };
  return { url: resolved.url, loading: false, error: resolved.error };
}
