import React, { useRef, useState } from 'react';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import '@/pages/admin/admin.css';

export const AdminMicrolearning: React.FC = () => {
  const { adminKey } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState({
    title: '',
    type: 'vocabulary',
    content: '',
    translation: '',
    scheduledFor: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const adminHeaders = () => ({
    'x-admin-key': adminKey || '',
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setSaving(true);
    try {
      await api.post('/microlearning/admin/create', content, { headers: adminHeaders() });
      setSuccess('Pill saved successfully');
      setContent({
        title: '',
        type: 'vocabulary',
        content: '',
        translation: '',
        scheduledFor: '',
      });
    } catch {
      setError('Could not save the pill. Check the fields and admin key.');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      setError('Select a JSON file first');
      return;
    }

    setSuccess('');
    setError('');
    setUploading(true);

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        throw new Error('JSON must be an array of pills');
      }

      await api.post('/microlearning/admin/bulk', data, { headers: adminHeaders() });
      setSuccess(`Bulk upload successful: ${data.length} pill(s) imported`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const message =
        err instanceof SyntaxError
          ? 'The file is not valid JSON'
          : err instanceof Error
            ? err.message
            : 'Failed to upload JSON';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Microlearning</h1>
        <p>Create daily pills or import a bulk JSON.</p>
      </header>

      {success && <div className="admin-alert ok">{success}</div>}
      {error && <div className="admin-alert err">{error}</div>}

      <div className="admin-card">
          <h3>Bulk upload (JSON)</h3>
          <p className="page-description" style={{ marginTop: 0 }}>
            Select a <code>.json</code> file (array of pills), then click{' '}
            <strong>Upload JSON</strong>.
          </p>
          <div className="admin-form-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="admin-input"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                setError('');
                setSuccess('');
              }}
            />
            <button
              type="button"
              className="admin-btn primary"
              onClick={() => void handleBulkUpload()}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading…' : 'Upload JSON'}
            </button>
          </div>
          {selectedFile && (
            <p className="page-description" style={{ marginBottom: 0, marginTop: 12 }}>
              File ready: <strong>{selectedFile.name}</strong>
            </p>
          )}
          <p className="page-description" style={{ marginBottom: 0, marginTop: 12 }}>
            Sample: download{' '}
            <a href="/microlearning-bulk-sample.json" download>
              microlearning-bulk-sample.json
            </a>
          </p>
        </div>

        <div className="admin-card">
          <h3>Manual entry</h3>
          <form onSubmit={handleManualSubmit}>
            <div className="admin-form-row" style={{ marginBottom: 12 }}>
              <input
                className="admin-input"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="Title"
                value={content.title}
                onChange={(e) => setContent({ ...content, title: e.target.value })}
                required
              />
              <select
                className="admin-select"
                value={content.type}
                onChange={(e) => setContent({ ...content, type: e.target.value })}
              >
                <option value="vocabulary">Vocabulary</option>
                <option value="phrasal_verb">Phrasal Verb</option>
                <option value="audio">Audio (text)</option>
              </select>
              <input
                type="date"
                className="admin-input"
                value={content.scheduledFor}
                onChange={(e) => setContent({ ...content, scheduledFor: e.target.value })}
              />
            </div>
            <textarea
              className="admin-input"
              style={{ width: '100%', minHeight: 90, marginBottom: 12, resize: 'vertical' }}
              placeholder="Content in English"
              value={content.content}
              onChange={(e) => setContent({ ...content, content: e.target.value })}
              required
            />
            <textarea
              className="admin-input"
              style={{ width: '100%', minHeight: 70, marginBottom: 12, resize: 'vertical' }}
              placeholder="Translation / explanation (optional)"
              value={content.translation}
              onChange={(e) => setContent({ ...content, translation: e.target.value })}
            />
            <button type="submit" className="admin-btn accent" disabled={saving}>
              {saving ? 'Saving…' : 'Save pill'}
            </button>
          </form>
        </div>
    </div>
  );
};
