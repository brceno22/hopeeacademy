//MicrolearningWidget.tsx
import React, { useEffect, useState } from 'react';
import api from '@/core/api/axios';
import '@/features/forums/styles/widgets-forum.css';

interface MicroContent {
  id: number;
  title: string;
  type: 'vocabulary' | 'phrasal_verb' | 'audio';
  content: string;
  translation: string;
  audioUrl?: string;
}

export const MicrolearningWidget: React.FC = () => {
  const [data, setData] = useState<{ content: MicroContent; todayCompleted: boolean; currentStreak: number } | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchToday = async () => {
    try {
      const res = await api.get('/microlearning/today');
      setData(res.data);
    } catch (e) { console.error("No hay píldora hoy", e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchToday(); }, []);

  const handleComplete = async () => {
    if (!data) return;
    try {
      await api.post('/microlearning/complete', { contentId: data.content.id });
      fetchToday();
    } catch (e) { alert("Error al registrar progreso"); }
  };

  if (loading) return <div className="page-description">Cargando píldora diaria...</div>;
  if (!data) return null;

  return (
    <div className="widget-card">
      <h3 style={{ color: 'var(--secondary-color)' }}>🔥 Píldora diaria: {data.content.title}</h3>
      <div style={{ fontSize: '1.25rem', margin: '20px 0', color: 'var(--text-main)', fontWeight: '500' }}>
        {data.content.content}
      </div>
      
      {data.content.type === 'audio' && data.content.audioUrl && (
        <audio controls style={{ width: '100%', marginBottom: '20px', borderRadius: '8px' }}>
          <source src={data.content.audioUrl} type="audio/mpeg" />
        </audio>
      )}

      {data.todayCompleted ? (
        <div className="success-badge" style={{ width: '100%', justifyContent: 'center' }}>
          ¡Píldora completada! Volvé mañana por más 🔥
        </div>
      ) : (
        <>
          {data.content.translation && (
            <button 
              onClick={() => setShowTranslation(!showTranslation)} 
              style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', marginBottom: '16px', fontWeight: '600', padding: 0 }}
            >
              {showTranslation ? 'Ocultar traducción' : 'Ver traducción 👀'}
            </button>
          )}
          {showTranslation && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '20px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px' }}>
              {data.content.translation}
            </p>
          )}
          <button onClick={handleComplete} className="btn-card primary">
            ¡Entendido! +1 día a mi racha
          </button>
        </>
      )}
    </div>
  );
};