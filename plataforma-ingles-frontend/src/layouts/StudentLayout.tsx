import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { StudentLayoutProvider, useStudentLayout } from '../context/StudentLayoutContext';
import '../styles/student-layout.css';

const NAV_ITEMS = [
  { to: '/app/inicio', icon: '🏠', label: 'Inicio' },
  { to: '/app/programa', icon: '🎓', label: 'Mi programa' },
  { to: '/app/cursos', icon: '📚', label: 'Mis cursos' },
  { to: '/app/examenes', icon: '📝', label: 'Exámenes' },
  { to: '/app/perfil', icon: '👤', label: 'Mi perfil' },
];

function LayoutInner() {
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
          <span className="logo">🇬🇧</span>
          {!sidebarCollapsed && (
            <div>
              <h1>Hopee English</h1>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Academia virtual</small>
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
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="student-sidebar-footer">
          <button type="button" className="nav-item" onClick={handleLogout} title="Cerrar sesión">
            <span className="icon">🚪</span>
            {!sidebarCollapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="student-main-wrap">
        <header className="student-header">
          <button type="button" className="toggle-sidebar-btn" onClick={toggleSidebar} aria-label="Menú">
            ☰
          </button>
          <h2 className="student-header-title">{headerTitle}</h2>

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

          <div className="user-chip">
            <span>👋 {fullName}</span>
          </div>
        </header>

        <main className="student-content">
          <Outlet />
        </main>

        <footer className="student-footer">
          © 2026 Hopee English — Academia virtual de inglés · Soporte: soporte@hopee-english.com ·
          Horario de atención: Lun–Vie 9:00–18:00 · Certificaciones internacionales Cambridge &amp; TOEFL prep.
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
