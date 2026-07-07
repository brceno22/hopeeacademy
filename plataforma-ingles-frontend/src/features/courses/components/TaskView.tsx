//TaskView.tsx
import React, { useState, useEffect, useRef } from 'react';
import api from '@/core/api/axios';
import "@/features/forums/styles/widgets-forum.css";

interface TaskViewProps {
  module: { name: string; description: string; instanceId?: number; };
}

export const TaskView: React.FC<TaskViewProps> = ({ module }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!module.instanceId) { setLoading(false); return; }
    fetchStatus();
  }, [module.instanceId]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/${module.instanceId}/status`, { headers: { 'x-user-token': token } });
      setStatus(res.data);
    } catch (err) { setError('No se pudo cargar el estado de la tarea.'); } 
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!text && !file) { setError('Debés escribir algo o adjuntar un archivo.'); return; }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      let fileBase64, fileMimeType, fileName;
      if (file) {
        fileName = file.name; fileMimeType = file.type;
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      await api.post(`/tasks/${module.instanceId}/submit`, {
        token, text, fileName, fileBase64, fileMimeType, userId: parseInt(localStorage.getItem('moodleUserId') || '0'),
      });
      setSuccess('¡Tarea entregada correctamente! ✅');
      await fetchStatus(); setText(''); setFile(null);
    } catch (err: any) { setError(err.response?.data?.message || 'Error al entregar la tarea.'); } 
    finally { setSubmitting(false); }
  };

  const getStatusInfo = () => {
    if (!status) return null;
    const submission = status.lastattempt?.submission;
    const grading = status.feedback?.grade;

    if (grading?.grade && parseFloat(grading.grade) >= 0) {
      return { color: '#059669', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', icon: '⭐', label: `Calificado: ${parseFloat(grading.grade).toFixed(1)} / ${grading.grade}` };
    }
    if (submission?.status === 'submitted') {
      return { color: 'var(--primary-color)', bg: 'rgba(0, 113, 188, 0.1)', border: 'rgba(0, 113, 188, 0.2)', icon: '✅', label: 'Entregado — pendiente de calificación' };
    }
    if (submission?.status === 'draft') {
      return { color: 'var(--secondary-color)', bg: 'rgba(255, 123, 0, 0.1)', border: 'rgba(255, 123, 0, 0.2)', icon: '📝', label: 'Borrador guardado' };
    }
    return { color: 'var(--text-muted)', bg: 'var(--bg-surface)', border: 'var(--border-color)', icon: '⏳', label: 'Sin entregar' };
  };

  const statusInfo = getStatusInfo();

  if (loading) return <div className="page-description" style={{ padding: '40px', textAlign: 'center' }}>Cargando tarea...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(0, 113, 188, 0.1)', color: 'var(--primary-color)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', marginBottom: '16px' }}>
          📝
        </div>
        <h2 style={{ margin: 0, color: 'var(--primary-color)', fontFamily: 'var(--font-titles)', fontSize: '2rem', textAlign: 'center' }}>
          {module.name}
        </h2>
      </div>

      {module.description && (
        <div className="html-content-render widget-card" dangerouslySetInnerHTML={{ __html: module.description }} />
      )}

      {statusInfo && (
        <div className="status-badge" style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.border}` }}>
          <span style={{ fontSize: '28px' }}>{statusInfo.icon}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 'bold', color: statusInfo.color, fontSize: '1.1rem' }}>{statusInfo.label}</p>
            {status?.feedback?.grade?.grader && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Calificado por: {status.feedback.grade.grader}</p>
            )}
          </div>
        </div>
      )}

      {success && <div className="success-badge" style={{ width: '100%', marginBottom: '24px' }}>{success}</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontWeight: '600' }}>{error}</div>}

      <div className="widget-card">
        <h3 style={{ marginBottom: '24px' }}>📤 Entregar tarea</h3>

        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)' }}>Respuesta en texto</label>
        <textarea
          className="forum-input-box"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escribí tu respuesta acá..."
          rows={5}
          style={{ marginBottom: '24px', resize: 'vertical' }}
        />

        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)' }}>Adjuntar archivo</label>
        <div className={`task-upload-zone ${file ? 'has-file' : ''}`} onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div>
              <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem' }}>📎 {file.name}</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div>
              <p style={{ margin: 0, fontSize: '32px' }}>📁</p>
              <p style={{ margin: '12px 0 0 0', color: 'var(--text-muted)', fontWeight: '500' }}>Hacé click para seleccionar un archivo</p>
            </div>
          )}
        </div>

        <button className="btn-card primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Enviando...' : 'Entregar Tarea 📤'}
        </button>
      </div>
    </div>
  );
};