const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function normalizePort(u: URL): string {
  if (u.port) return u.port;
  return u.protocol === 'https:' ? '443' : '80';
}

export function originsEquivalent(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    if (ua.protocol !== ub.protocol) return false;
    if (normalizePort(ua) !== normalizePort(ub)) return false;
    const ha = ua.hostname.toLowerCase();
    const hb = ub.hostname.toLowerCase();
    if (ha === hb) return true;
    return LOOPBACK_HOSTS.has(ha) && LOOPBACK_HOSTS.has(hb);
  } catch {
    return false;
  }
}

export function rewriteToMoodleOrigin(fileUrl: string, moodleOrigin: string): string {
  const parsed = new URL(fileUrl);
  const origin = new URL(moodleOrigin);
  parsed.protocol = origin.protocol;
  parsed.hostname = origin.hostname;
  parsed.port = origin.port;
  return parsed.toString();
}

export function candidatePluginfileBases(cleanedUrl: string, isUserIcon: boolean): string[] {
  const withWs = cleanedUrl.includes('/webservice/')
    ? cleanedUrl
    : cleanedUrl.replace('/pluginfile.php', '/webservice/pluginfile.php');
  const withoutWs = cleanedUrl.replace('/webservice/pluginfile.php', '/pluginfile.php');
  return isUserIcon
    ? Array.from(new Set([withoutWs, withWs]))
    : Array.from(new Set([withWs, withoutWs]));
}
