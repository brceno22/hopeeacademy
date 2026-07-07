import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { StudentLayoutProvider, useStudentLayout } from './StudentLayoutContext';
import "./student-layout.css";
import api from '../core/api/axios';

const NAV_ITEMS = [
  { to: '/app/inicio', icon: '🏠', label: 'Inicio' },
  { to: '/app/programa', icon: '🎓', label: 'Mi programa' },
  { to: '/app/cursos', icon: '📚', label: 'Mis cursos' },
  { to: '/app/examenes', icon: '📝', label: 'Exámenes' },
  { to: '/app/microlearning', icon: '⚡', label: 'Microlearning' },
  { to: '/app/foro', icon: '💬', label: 'Foro' },
  { to: '/app/progreso', icon: '📊', label: 'Mi progreso' },
  { to: '/app/perfil', icon: '👤', label: 'Mi perfil' },
];

function LayoutInner() {
  const [streak, setStreak] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    sidebarCollapsed,
    toggleSidebar,
    headerTitle,
    headerTabs,
    activeTabId,
    setActiveTabId,
    clearHeaderTabs,
  } = useStudentLayout();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/');
  }, [navigate]);

  useEffect(() => {
    if (location.pathname === '/app/inicio' || location.pathname === '/app') {
      clearHeaderTabs();
    }
  }, [location.pathname, clearHeaderTabs]);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const res = await api.get('/microlearning/today');
        setStreak(res.data.currentStreak);
      } catch (e) {}
    };
    fetchStreak();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('moodleUserId');
    localStorage.removeItem('fullName');
    navigate('/');
  };

  const fullName = localStorage.getItem('fullName') || 'Estudiante';

  return (
    <div className={`student-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`student-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="student-sidebar-brand">
          <div className="logo-container">
            <img 
              src="/Iso-naranja-Hopee-Academy.png" 
              alt="Logo" 
              className="sidebar-logo-img" 
            />
          </div>
          {!sidebarCollapsed && (
            <div className="brand-text">
              <h1>Hopee Academy</h1>
              <small>Campus Virtual</small>
            </div>
          )}
        </div>

        <nav className="student-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="student-sidebar-footer">
          <button type="button" className="nav-item-logout" onClick={handleLogout} title="Cerrar sesión">
            <span className="icon">🚪</span>
            {!sidebarCollapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="student-main-wrap">
        <header className="student-header">
          <div className="header-left">
            <button type="button" className="toggle-sidebar-btn" onClick={toggleSidebar} aria-label="Menú">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h2 className="student-header-title">{headerTitle}</h2>
          </div>

          {headerTabs.length > 0 && (
            <div className="student-header-tabs">
              {headerTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`student-header-tab ${activeTabId === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="header-right">
            <div className={`streak-chip ${streak > 0 ? 'active' : 'inactive'}`}>
              <span className="flame-icon">🔥</span>
              <span className="streak-text">{streak} días</span>
            </div>
            <div className="user-profile-chip">
              <div className="avatar-placeholder">
                {fullName.charAt(0).toUpperCase()}
              </div>
              <span className="user-greeting">Hola, <strong>{fullName.split(' ')[0]}</strong></span>
            </div>
          </div>
        </header>

        <main className="student-content">
          <Outlet />
        </main>

        <footer className="student-footer">
          <p>© 2026 <strong>Hopee English</strong> — Academia virtual de inglés</p>
          <p className="footer-meta">Soporte: soporte@hopee-english.com · Lun–Vie 9:00–18:00</p>
        </footer>
      </div>
    </div>
  );
}

export const StudentLayout: React.FC = () => (
  <StudentLayoutProvider>
    <LayoutInner />
  </StudentLayoutProvider>
);