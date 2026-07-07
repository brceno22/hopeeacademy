import React, { useEffect, useState } from 'react';
import api from '../../core/api/axios';

interface CourseProgress {
  courseId: number;
  name: string;
  percentage: number;
}

interface GlobalProgressData {
  totalCourses: number;
  completedCourses: number;
  globalPercentage: number;
  details: CourseProgress[];
}

export const ProgressView: React.FC = () => {
  const [progress, setProgress] = useState<GlobalProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        // Le pegamos al endpoint global que armaste recién en el backend
        const response = await api.get('/progress/global');
        setProgress(response.data);
      } catch (err) {
        setError('Error al cargar tu progreso.');
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, []);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px' }}>Cargando tus estadísticas...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red', textAlign: 'center' }}>{error}</div>;
  if (!progress) return null;

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui', width: '100%' }}>
      <h1 style={{ marginBottom: '30px', color: '#333', fontSize: '28px' }}>Mi Progreso Académico</h1>

      {/* Tarjeta Global Principal */}
      <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '40px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, color: '#0056b3', fontSize: '22px' }}>Progreso General</h2>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#0056b3' }}>{progress.globalPercentage}%</span>
        </div>
        <p style={{ color: '#666', marginBottom: '20px', fontSize: '16px' }}>
          Llevás completadas <strong>{progress.completedCourses}</strong> de <strong>{progress.totalCourses}</strong> clases.
        </p>
        
        {/* Barra gruesa global */}
        <div style={{ width: '100%', height: '24px', background: '#e9ecef', borderRadius: '12px', overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${progress.globalPercentage}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #0056b3 0%, #00a8ff 100%)', 
              transition: 'width 1s ease-in-out' 
            }} 
          />
        </div>
      </div>

      {/* Lista detallada por Clase */}
      <h3 style={{ marginBottom: '20px', color: '#444', fontSize: '20px' }}>Detalle por Clase</h3>
      {progress.details.length === 0 ? (
        <p style={{ color: '#666' }}>Todavía no estás inscripto en ninguna clase.</p>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {progress.details.map((course) => (
            <div key={course.courseId} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong style={{ fontSize: '16px', color: '#333' }}>{course.name}</strong>
                <span style={{ fontWeight: 'bold', color: course.percentage === 100 ? '#28a745' : '#666' }}>
                  {course.percentage}%
                </span>
              </div>
              
              {/* Barra finita por curso */}
              <div style={{ width: '100%', height: '8px', background: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${course.percentage}%`, 
                    height: '100%', 
                    background: course.percentage === 100 ? '#28a745' : '#17a2b8', 
                    transition: 'width 1s ease-in-out' 
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};