import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import type { CourseFolderNode } from '@/core/types/courses-catalog';
import './admin.css';

interface RecordingRow {
  id: number;
  folderId: number;
  folderName: string | null;
  title: string;
  driveUrl: string;
  recordedAt: string | null;
  isActive: boolean;
}

function flatFolders(
  nodes: CourseFolderNode[],
  depth = 0,
): { node: CourseFolderNode; depth: number }[] {
  const out: { node: CourseFolderNode; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    out.push(...flatFolders(n.children ?? [], depth + 1));
  }
  return out;
}

export const AdminRecordings: React.FC = () => {
  const navigate = useNavigate();
  const { adminKey } = useAuth();
  const headers = { 'x-admin-key': adminKey || '' };

  const [folders, setFolders] = useState<CourseFolderNode[]>([]);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [recFolderId, setRecFolderId] = useState('');
  const [recTitle, setRecTitle] = useState('');
  const [recUrl, setRecUrl] = useState('');
  const [recDate, setRecDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingRec, setEditingRec] = useState<{
    id: number;
    title: string;
    driveUrl: string;
    recordedAt: string;
    isActive: boolean;
  } | null>(null);

  const allFlat = flatFolders(folders);

  const loadRecordings = async (folderId?: string) => {
    const qs = folderId ? `?folderId=${folderId}` : '';
    const res = await api.get(`/recordings/admin${qs}`, { headers });
    setRecordings(res.data);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const treeRes = await api.get('/courses/admin/tree', { headers });
      setFolders(treeRes.data);
      await loadRecordings(recFolderId || undefined);
    } catch {
      setError('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminKey) navigate('/admin');
    else void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const createRecording = async () => {
    const folderId = parseInt(recFolderId, 10);
    if (!folderId || !recTitle.trim() || !recUrl.trim()) {
      setError('Fill in folder, title, and Drive URL');
      return;
    }
    try {
      await api.post(
        '/recordings/admin',
        {
          folderId,
          title: recTitle.trim(),
          driveUrl: recUrl.trim(),
          recordedAt: recDate || undefined,
        },
        { headers },
      );
      setRecTitle('');
      setRecUrl('');
      setRecDate('');
      setSuccess('Recording added');
      await loadRecordings(recFolderId || undefined);
    } catch {
      setError('Could not add recording (check the URL)');
    }
  };

  const saveRecordingEdit = async () => {
    if (!editingRec) return;
    try {
      await api.patch(
        `/recordings/admin/${editingRec.id}`,
        {
          title: editingRec.title,
          driveUrl: editingRec.driveUrl,
          recordedAt: editingRec.recordedAt || null,
          isActive: editingRec.isActive,
        },
        { headers },
      );
      setEditingRec(null);
      setSuccess('Recording updated');
      await loadRecordings(recFolderId || undefined);
    } catch {
      setError('Could not save recording');
    }
  };

  const deleteRecording = async (id: number) => {
    if (!confirm('Delete this recording?')) return;
    try {
      await api.delete(`/recordings/admin/${id}`, { headers });
      setSuccess('Recording deleted');
      await loadRecordings(recFolderId || undefined);
    } catch {
      setError('Could not delete');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Recorded classes</h1>
        <p>Link a Drive URL to a folder/class. Students see it embedded in the app.</p>
      </header>

      {success && <div className="admin-alert ok">{success}</div>}
      {error && <div className="admin-alert err">{error}</div>}

      <div className="admin-card">
        <h3>New recording</h3>
        <div className="admin-form-row" style={{ marginBottom: 12 }}>
          <select
            className="admin-select"
            value={recFolderId}
            onChange={(e) => {
              setRecFolderId(e.target.value);
              void loadRecordings(e.target.value || undefined);
            }}
          >
            <option value="">Select folder to filter / create</option>
            {allFlat.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'—'.repeat(depth)} {node.name}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form-row">
          <input
            className="admin-input"
            placeholder="Title"
            value={recTitle}
            onChange={(e) => setRecTitle(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <input
            className="admin-input"
            placeholder="https://drive.google.com/file/d/.../view"
            value={recUrl}
            onChange={(e) => setRecUrl(e.target.value)}
            style={{ flex: 2, minWidth: 220 }}
          />
          <input
            type="date"
            className="admin-input"
            value={recDate}
            onChange={(e) => setRecDate(e.target.value)}
          />
          <button type="button" className="admin-btn primary" onClick={() => void createRecording()}>
            Add
          </button>
        </div>
      </div>

      <div className="admin-card">
        <h3>List</h3>
        {loading ? (
          <p className="page-description">Loading…</p>
        ) : recordings.length === 0 ? (
          <p className="page-description">No recordings yet.</p>
        ) : (
          <ul className="admin-course-list">
            {recordings.map((r) => (
              <li key={r.id} style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <strong>{r.title}</strong>
                  <span className="admin-folder-meta">
                    {r.folderName || `Folder #${r.folderId}`}
                    {r.recordedAt ? ` · ${String(r.recordedAt).slice(0, 10)}` : ''}
                    {r.isActive ? '' : ' · inactive'}
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                    {r.driveUrl}
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-btn accent"
                  onClick={() =>
                    setEditingRec({
                      id: r.id,
                      title: r.title,
                      driveUrl: r.driveUrl,
                      recordedAt: r.recordedAt ? String(r.recordedAt).slice(0, 10) : '',
                      isActive: r.isActive,
                    })
                  }
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => void deleteRecording(r.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingRec && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3 style={{ marginTop: 0 }}>Edit recording</h3>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Title</label>
            <input
              className="admin-input"
              style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
              value={editingRec.title}
              onChange={(e) => setEditingRec({ ...editingRec, title: e.target.value })}
            />
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Drive URL</label>
            <input
              className="admin-input"
              style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
              value={editingRec.driveUrl}
              onChange={(e) => setEditingRec({ ...editingRec, driveUrl: e.target.value })}
            />
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Date</label>
            <input
              type="date"
              className="admin-input"
              style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
              value={editingRec.recordedAt}
              onChange={(e) => setEditingRec({ ...editingRec, recordedAt: e.target.value })}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 20,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={editingRec.isActive}
                onChange={(e) => setEditingRec({ ...editingRec, isActive: e.target.checked })}
              />
              Active (visible to students)
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="admin-btn muted" onClick={() => setEditingRec(null)}>
                Cancel
              </button>
              <button type="button" className="admin-btn primary" onClick={() => void saveRecordingEdit()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
