/**
 * Convierte URLs de Google Drive / Docs a forma embebbible (/preview).
 * Si no se reconoce, retorna null (el cliente puede abrir driveUrl externo).
 */
export function toDriveEmbedUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'drive.google.com' && host !== 'docs.google.com') {
    return null;
  }

  // /file/d/{ID}/view|preview|edit
  const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }

  // /open?id={ID} o ?id={ID}
  const idParam = url.searchParams.get('id');
  if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) {
    return `https://drive.google.com/file/d/${idParam}/preview`;
  }

  // docs.google.com/presentation or document — leave as-is preview if possible
  const docsMatch = url.pathname.match(/\/(document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch?.[2]) {
    const kind = docsMatch[1];
    return `https://docs.google.com/${kind}/d/${docsMatch[2]}/preview`;
  }

  return null;
}

export function assertHttpUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('URL inválida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('La URL debe ser http(s)');
  }
  if (trimmed.toLowerCase().startsWith('javascript:')) {
    throw new Error('URL no permitida');
  }
  return trimmed;
}
