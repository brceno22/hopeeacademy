import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

interface TaskViewProps {
  module: {
    name: string;
    description: string;
    instanceId?: number;
  };
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
      const res = await api.get(`/tasks/${module.instanceId}/status`, {
        headers: { 'x-user-token': token },
      });
      setStatus(res.data);
    } catch (err) {
      setError('No se pudo cargar el estado de la tarea.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!text && !file) {
      setError('Debés escribir algo o adjuntar un archivo.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      let fileBase64: string | undefined;
      let fileMimeType: string | undefined;
      let fileName: string | undefined;

      // Convertir archivo a base64 si existe
      if (file) {
        fileName = file.name;
        fileMimeType = file.type;
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Sacamos el prefijo "data:application/pdf;base64," y dejamos solo el base64
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      await api.post(`/tasks/${module.instanceId}/submit`, {
        token,
        text,
        fileName,
        fileBase64,
        fileMimeType,
        userId: parseInt(localStorage.getItem('moodleUserId') || '0'),
      });

      setSuccess('¡Tarea entregada correctamente! ✅');
      await fetchStatus();
      setText('');
      setFile(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al entregar la tarea.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusInfo = () => {
    if (!status) return null;
    const submission = status.lastattempt?.submission;
    const grading = status.feedback?.grade;

    if (grading?.grade && parseFloat(grading.grade) >= 0) {
      return {
        color: '#2e7d32',
        bg: '#e8f5e9',
        icon: '⭐',
        label: `Calificado: ${parseFloat(grading.grade).toFixed(1)} / ${grading.grade}`,
      };
    }
    if (submission?.status === 'submitted') {
      return { color: '#1565c0', bg: '#e3f2fd', icon: '✅', label: 'Entregado — pendiente de calificación' };
    }
    if (submission?.status === 'draft') {
      return { color: '#e65100', bg: '#fff3e0', icon: '📝', label: 'Borrador guardado' };
    }
    return { color: '#666', bg: '#f5f5f5', icon: '⏳', label: 'Sin entregar' };
  };

  const statusInfo = getStatusInfo();

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
      Cargando tarea...
    </div>
  );

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
      
      {/* Icono y título */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '50%', fontSize: '40px', marginBottom: '15px' }}>
          📝
        </div>
        <h2 style={{ margin: 0, color: '#1a1a1a', textAlign: 'center' }}>{module.name}</h2>
      </div>

      {/* Descripción */}
      {module.description && (
        <div
          style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '20px', marginBottom: '25px', lineHeight: '1.6', color: '#444' }}
          dangerouslySetInnerHTML={{ __html: module.description }}
        />
      )}

      {/* Estado actual */}
      {statusInfo && (
        <div style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.color}30`, borderRadius: '8px', padding: '15px 20px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>{statusInfo.icon}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 'bold', color: statusInfo.color }}>{statusInfo.label}</p>
            {status?.feedback?.grade?.grader && (
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                Calificado por: {status.feedback.grade.grader}
              </p>
            )}
          </div>
        </div>
      )}

      {success && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '15px', marginBottom: '20px', color: '#2e7d32', fontWeight: 'bold' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ background: '#fce4ec', border: '1px solid #f48fb1', borderRadius: '8px', padding: '15px', marginBottom: '20px', color: '#c62828' }}>
          {error}
        </div>
      )}

      {/* Formulario de entrega */}
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '25px' }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>📤 Entregar tarea</h3>

        {/* Texto */}
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#444' }}>
          Respuesta en texto
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escribí tu respuesta acá..."
          rows={6}
          style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical', marginBottom: '20px', fontFamily: 'system-ui' }}
        />

        {/* Archivo */}
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#444' }}>
          Adjuntar archivo
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{ border: '2px dashed #ddd', borderRadius: '8px', padding: '30px', textAlign: 'center', cursor: 'pointer', marginBottom: '25px', background: file ? '#f3e5f5' : '#fafafa' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#9c27b0' }}>📎 {file.name}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <p style={{ margin: 0, fontSize: '24px' }}>📁</p>
              <p style={{ margin: '8px 0 0 0', color: '#888' }}>Hacé click para seleccionar un archivo</p>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: '100%', padding: '14px', background: submitting ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? 'Enviando...' : 'Entregar Tarea 📤'}
        </button>
      </div>
    </div>
  );
};