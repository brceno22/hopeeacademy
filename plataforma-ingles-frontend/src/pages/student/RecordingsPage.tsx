import React from 'react';
import { Link } from 'react-router-dom';
import { useRecordings } from '@/core/hooks/useRecordings';
import { EmptyState } from '@/core/ui/EmptyState';
import '@/core/ui/ui.css';
import './recordings-page.css';

export const RecordingsPage: React.FC = () => {
  const { data: groups = [], isPending: loading, isError } = useRecordings();
  const error = isError ? 'Could not load recorded classes' : '';

  if (loading) {
    return (
      <div className="recordings-page fade-in-page">
        <div className="skeleton" style={{ height: 28, width: 240, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 100, width: '100%', borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div className="recordings-page fade-in-page">
      <header className="recordings-header">
        <h1>Recorded classes</h1>
        <p>Review your class recordings whenever you want.</p>
      </header>

      {error && (
        <div className="recordings-alert" role="alert">
          {error}
        </div>
      )}

      {!error && groups.length === 0 ? (
        <EmptyState
          icon="🎬"
          title="No recordings yet"
          description="When the team uploads classes to Drive, they’ll show up here organized by folder."
        />
      ) : (
        <div className="recordings-groups">
          {groups.map((g) => (
            <section key={g.folderId} className="recordings-group">
              <h2>{g.folderName}</h2>
              <ul className="recordings-list">
                {g.recordings.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>{r.title}</strong>
                      {r.recordedAt && (
                        <span className="recordings-date">
                          {String(r.recordedAt).slice(0, 10)}
                        </span>
                      )}
                    </div>
                    <Link className="btn-card primary recordings-watch-btn" to={`/app/grabaciones/${r.id}`}>
                      Watch class
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
