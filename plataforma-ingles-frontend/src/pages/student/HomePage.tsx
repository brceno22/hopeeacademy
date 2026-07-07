import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../core/api/axios';
import "./home-page.css";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const fullName = localStorage.getItem('fullName') || 'Estudiante';
  const firstName = fullName.split(' ')[0];

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const res = await api.get('/microlearning/today');
        setStreak(res.data.currentStreak);
      } catch (e) {
        console.error('Error cargando datos de inicio:', e);
      }
    };
    fetchHomeData();
  }, []);

  return (
    <div className="home-container">
      {/* 1. BANNER BIENVENIDA */}
      <section className="welcome-banner">
        <div className="welcome-text">
          <h1>Welcome back, {firstName}! 👋</h1>
          <p>Listo para dominar el inglés hoy? Tenés un mundo de posibilidades esperándote.</p>
        </div>
        <div className="welcome-badge">
          <span className="flag-bubble">🇬🇧</span>
        </div>
      </section>

      {/* 2. GRILLA DE CONTENIDO */}
      <div className="home-grid">
        
        {/* TARJETA DE RACHA / ACCIÓN RÁPIDA */}
        <div className="home-card action-card">
          <div className="card-header-icon orange-bg">⚡</div>
          <h3>Tu racha diaria</h3>
          <p className="streak-counter">
            🔥 <span>{streak} {streak === 1 ? 'día' : 'días'} seguidos</span>
          </p>
          <p className="card-desc">No pierdas el impulso. Completá el desafío diario de microlearning en 5 minutos.</p>
          <button 
            type="button" 
            className="btn-card primary"
            onClick={() => navigate('/app/microlearning')}
          >
            Practicar ahora
          </button>
        </div>

        {/* TARJETA DE MIS CURSOS */}
        <div className="home-card">
          <div className="card-header-icon blue-bg">📚</div>
          <h3>Mis Cursos activos</h3>
          <p className="card-desc">Accedé directamente a tus clases, materiales interactivos y contenidos de Moodle.</p>
          <button 
            type="button" 
            className="btn-card secondary"
            onClick={() => navigate('/app/cursos')}
          >
            Ir a mis cursos
          </button>
        </div>

        {/* TARJETA DEL FORO DE LA COMUNIDAD */}
        <div className="home-card">
          <div className="card-header-icon purple-bg">💬</div>
          <h3>Foro de la comunidad</h3>
          <p className="card-desc">¿Tenés dudas con alguna regla gramatical o vocabulario? Preguntale a tus compañeros.</p>
          <button 
            type="button" 
            className="btn-card secondary"
            onClick={() => navigate('/app/foro')}
          >
            Entrar al foro
          </button>
        </div>

      </div>

      {/* 3. SECCIÓN DE RECOMENDACIÓN O TIPS */}
      <section className="tip-of-the-day">
        <div className="tip-icon">💡</div>
        <div className="tip-content">
          <h4>Tip de estudio del día</h4>
          <p>"La constancia le gana al talento. Es preferible estudiar 10 minutos todos los días a meter una maratón de 4 horas el fin de semana. ¡Hacé valer tu microlearning!"</p>
        </div>
      </section>
    </div>
  );
};