import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentLayout } from '../../context/StudentLayoutContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { setHeaderTitle, clearHeaderTabs } = useStudentLayout();

  useEffect(() => {
    setHeaderTitle('Inicio');
    clearHeaderTabs();
  }, [setHeaderTitle, clearHeaderTabs]);

  return (
    <>
      <section className="home-hero">
        <h2>Bienvenido a Hopee English</h2>
        <p>
          Tu academia virtual para dominar el inglés con metodología comunicativa, profesores certificados
          y contenido alineado a los marcos MCER (A1–C1). Empezá por Mi programa o explorá todos tus cursos.
        </p>
        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/app/programa')}
            style={{
              padding: '14px 28px',
              background: '#f59e0b',
              color: '#1e293b',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Ir a mi programa →
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/cursos')}
            style={{
              padding: '14px 28px',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Ver todos los cursos
          </button>
        </div>
      </section>

      <div className="home-grid">
        <article className="home-card">
          <h3>🎯 Clases en vivo</h3>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            Sesiones semanales con feedback personalizado y práctica oral en grupos reducidos.
          </p>
        </article>
        <article className="home-card">
          <h3>📖 Material MCER</h3>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            Rutas B1, B2 y C1 con lecciones, tareas y exámenes integrados desde nuestra plataforma Moodle.
          </p>
        </article>
        <article className="home-card">
          <h3>🏆 Certificación</h3>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            Preparación para exámenes internacionales con simulacros y seguimiento de progreso.
          </p>
        </article>
        <article className="home-card">
          <h3>💬 Comunidad Hopee</h3>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            Club de conversación, recursos extra y soporte académico dedicado para cada nivel.
          </p>
        </article>
      </div>
    </>
  );
};
