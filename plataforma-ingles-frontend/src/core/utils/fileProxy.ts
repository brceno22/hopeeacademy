import api, { API_BASE_URL } from '@/core/api/axios';

/**
 * El proxy de archivos se consume desde atributos `src` de <img> e <iframe>,
 * donde no se pueden enviar headers. En lugar del token de Moodle, la URL
 * lleva un ticket opaco de corta duración que el backend emite por separado.
 */

/** El backend expira los tickets a los 5 min; renovamos antes para no cortar. */
export const TICKET_REFRESH_MS = 4 * 60 * 1000;

const MAX_URLS_PER_REQUEST = 50;

function proxyUrlForTicket(ticket: string): string {
  const params = new URLSearchParams({ ticket });
  return `${API_BASE_URL}/files/proxy?${params.toString()}`;
}

/** Normaliza una URL de Moodle al formato que acepta el backend. */
export function cleanMoodleFileUrl(url: string): string {
  return url
    .replace('webservice/pluginfile.php', 'pluginfile.php')
    .replace(/[?&]forcedownload=1/g, '');
}

/**
 * Pide tickets en lote: una página de curso puede tener decenas de imágenes y
 * de a una serían otras tantas requests.
 */
export async function fetchFileProxyUrls(urls: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const result = new Map<string, string>();

  for (let i = 0; i < unique.length; i += MAX_URLS_PER_REQUEST) {
    const batch = unique.slice(i, i + MAX_URLS_PER_REQUEST);
    const res = await api.post<{ tickets: Record<string, string> }>('/files/tickets', {
      urls: batch,
    });
    for (const [url, ticket] of Object.entries(res.data.tickets || {})) {
      result.set(url, proxyUrlForTicket(ticket));
    }
  }

  return result;
}

/** Atajo para una sola URL. Devuelve null si el backend rechaza el ticket. */
export async function fetchFileProxyUrl(url: string): Promise<string | null> {
  const map = await fetchFileProxyUrls([url]);
  return map.get(url) ?? null;
}
