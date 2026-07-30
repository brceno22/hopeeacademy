import React, { useEffect, useState } from 'react';
import { buildFileProxyUrl } from '@/core/utils/fileProxy';

interface Props {
  fileUrl: string;
  token: string;
  title: string;
  moodleUrl?: string;
}

/**
 * Loads Moodle files via /files/proxy as a blob and shows them in a same-origin
 * iframe (blob:). Cross-origin PDF iframes are often blank even when download works.
 */
export const ResourceFileViewer: React.FC<Props> = ({
  fileUrl,
  token,
  title,
  moodleUrl,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [proxyUrl, setProxyUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const cleanUrl = fileUrl
      .replace('webservice/pluginfile.php', 'pluginfile.php')
      .replace(/[?&]forcedownload=1/g, '');
    const proxy = buildFileProxyUrl(cleanUrl, token);
    setProxyUrl(proxy);
    setLoading(true);
    setError('');
    setBlobUrl(null);

    (async () => {
      try {
        const res = await fetch(proxy, { credentials: 'omit' });
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as { message?: string; detail?: string };
            detail = j.detail || j.message || detail;
          } catch {
            // ignore
          }
          throw new Error(detail);
        }
        const buf = await res.arrayBuffer();
        const header = new Uint8Array(buf.slice(0, 5));
        const isPdf =
          header[0] === 0x25 &&
          header[1] === 0x50 &&
          header[2] === 0x44 &&
          header[3] === 0x46; // %PDF

        const contentType =
          res.headers.get('content-type') ||
          (isPdf ? 'application/pdf' : 'application/octet-stream');

        const blob = new Blob([buf], { type: contentType.split(';')[0].trim() });
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setBlobUrl(objectUrl);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load file');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, token]);

  if (loading) {
    return <p className="page-description">Loading file…</p>;
  }

  if (error || !blobUrl) {
    return (
      <div className="home-card" style={{ textAlign: 'center', padding: 28 }}>
        <p style={{ margin: '0 0 8px', color: '#c62828' }}>
          Could not preview the file{error ? `: ${error}` : ''}.
        </p>
        <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.9rem' }}>
          You can still open or download it.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {proxyUrl ? (
            <a
              href={proxyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-card primary"
              style={{ width: 'auto', padding: '10px 18px', textDecoration: 'none' }}
            >
              Open / download
            </a>
          ) : null}
          {moodleUrl ? (
            <a href={moodleUrl} target="_blank" rel="noopener noreferrer">
              Open in Moodle
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="resource-viewer">
      <iframe
        src={blobUrl}
        title={title}
        style={{
          width: '100%',
          height: '70vh',
          minHeight: '500px',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          background: '#f8fafc',
        }}
      />
      <p style={{ marginTop: 12, textAlign: 'center' }}>
        <a
          href={blobUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="btn-card primary"
          style={{
            display: 'inline-flex',
            width: 'auto',
            padding: '10px 18px',
            textDecoration: 'none',
            marginRight: 10,
          }}
        >
          Open / download
        </a>
        {proxyUrl ? (
          <a href={proxyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>
            Direct link
          </a>
        ) : null}
      </p>
    </div>
  );
};
