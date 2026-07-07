//GlobalProgressWidget.tsx
import React, { useEffect, useState } from 'react';
import api from '../../../core/api/axios';
import '../styles/widgets-forum.css';

interface GlobalProgressData {
  totalCourses: number;
  completedCourses: number;
  globalPercentage: number;
  details: any[];
}

export const GlobalProgressWidget: React.FC = () => {
  const [progress, setProgress] = useState<GlobalProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalProgress = async () => {
      try {
        const response = await api.get('/progress/global');
        setProgress(response.data);
      } catch (error) { console.error('Error al cargar progreso', error); } 
      finally { setLoading(false); }
    };
    fetchGlobalProgress();
  }, []);

  if (loading || !progress || progress.totalCourses === 0) return null;

  return (
    <div className="widget-card">
      <h3>Tu Progreso Global</h3>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
        <span>Clases completadas: <strong>{progress.completedCourses}</strong> de {progress.totalCourses}</span>
        <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem' }}>{progress.globalPercentage}%</span>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress.globalPercentage}%` }} />
      </div>
    </div>
  );
};