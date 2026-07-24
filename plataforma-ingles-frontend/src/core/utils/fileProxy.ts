import { API_BASE_URL } from '@/core/api/axios';

/** Construye la URL del proxy de archivos Moodle usando VITE_API_URL. */
export function buildFileProxyUrl(fileUrl: string, token: string): string {
  const params = new URLSearchParams({
    url: fileUrl,
    token,
  });
  return `${API_BASE_URL}/files/proxy?${params.toString()}`;
}
