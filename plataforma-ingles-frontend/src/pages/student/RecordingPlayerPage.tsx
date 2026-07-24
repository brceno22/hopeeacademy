import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '@/core/api/axios';
import '@/core/ui/ui.css';
import './recordings-page.css';

interface RecordingDetail {
  id: number;
  folderId: number;
  folderName: string | null;
  title: string;
  driveUrl: string;
  embedUrl: string | null;
  recordedAt: string | null;
}

export const RecordingPlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [rec, setRec] = useState<RecordingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get<RecordingDetail>(`/recordings/${id}`);
        if (!cancelled) setRec(data);
      } catch {
        if (!cancelled) setError('Recording not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="recordings-page fade-in-page">
        <div className="skeleton" style={{ height: 24, width: 180, marginBottom: 16 }} />
        <div className="skeleton recordings-player-frame" />
      </div>
    );
  }

  if (error || !rec) {
    return (
      <div className="recordings-page fade-in-page">
        <Link to="/app/grabaciones" className="recordings-back">
          ← Back
        </Link>
        <div className="recordings-alert">{error || 'Recording unavailable'}</div>
      </div>
    );
  }

  return (
    <div className="recordings-page fade-in-page">
      <Link to="/app/grabaciones" className="recordings-back">
        ← Back to recordings
      </Link>

      <header className="recordings-header">
        <h1>{rec.title}</h1>
        <p>
          {rec.folderName || 'Class'}
          {rec.recordedAt ? ` · ${String(rec.recordedAt).slice(0, 10)}` : ''}
        </p>
      </header>

      {rec.embedUrl ? (
        <div className="recordings-player-wrap">
          <iframe
            className="recordings-player-frame"
            src={rec.embedUrl}
            title={rec.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="recordings-alert">
          Couldn’t embed this link. Open it directly in Drive.
        </div>
      )}

      <a
        className="btn-card secondary recordings-external"
        href={rec.driveUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open in Drive
      </a>
    </div>
  );
};
