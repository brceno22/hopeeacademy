import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import { useMicrolearningToday } from '@/core/hooks/useMicrolearningToday';
import { buildFileProxyUrl } from '@/core/utils/fileProxy';
import { StudentLayoutProvider, useStudentLayout } from './StudentLayoutContext';
import './student-layout.css';

const NAV_ITEMS = [
  { to: '/app/inicio', icon: '🏠', label: 'Home' },
  { to: '/app/programa', icon: '🎓', label: 'My program' },
  { to: '/app/cursos', icon: '📚', label: 'My courses' },
  { to: '/app/asistencia', icon: '✅', label: 'Attendance' },
  { to: '/app/calendario', icon: '📅', label: 'Calendar' },
  { to: '/app/grabaciones', icon: '🎬', label: 'Recorded classes' },
  { to: '/app/examenes', icon: '📝', label: 'Exams' },
  { to: '/app/microlearning', icon: '⚡', label: 'Microlearning' },
  { to: '/app/foro', icon: '💬', label: 'Forum' },
  { to: '/app/progreso', icon: '📊', label: 'My progress' },
];

function LayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logoutStudent, isAdmin, updateStudentProfile } = useAuth();
  const { data: microData } = useMicrolearningToday();
  const streak = microData?.currentStreak ?? 0;
  /** Moodle teacher role only; don’t use isAdmin (adminKey can linger from another session). */
  const [isTeacher, setIsTeacher] = useState(false);
  const [headerAvatar, setHeaderAvatar] = useState<string | null>(user?.avatarUrl || null);
  const [avatarBroken, setAvatarBroken] = useState(false);
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
    if (location.pathname === '/app/inicio' || location.pathname === '/app') {
      clearHeaderTabs();
    }
  }, [location.pathname, clearHeaderTabs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ isTeacher: boolean }>('/auth/capabilities');
        if (!cancelled) setIsTeacher(Boolean(data?.isTeacher));
      } catch {
        if (!cancelled) setIsTeacher(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.token]);

  useEffect(() => {
    setHeaderAvatar(user?.avatarUrl || null);
    setAvatarBroken(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    if (!user?.token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{
          avatar: string | null;
          fullname?: string;
          avatarColor?: string;
        }>('/users/me');
        if (cancelled) return;
        setHeaderAvatar(data.avatar || null);
        setAvatarBroken(false);
        updateStudentProfile({
          avatarUrl: data.avatar || null,
          fullName: data.fullname,
          avatarColor: data.avatarColor,
        });
      } catch {
        /* keep letter fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.token, updateStudentProfile]);

  const showAdminLink = isTeacher;

  const handleLogout = () => {
    logoutStudent();
    navigate('/');
  };

  const goAdmin = () => {
    navigate(isAdmin ? '/admin/inicio' : '/admin');
  };

  const fullName = user?.fullName || 'Student';
  const avatarSrc =
    headerAvatar && user?.token && !avatarBroken
      ? buildFileProxyUrl(headerAvatar, user.token)
      : null;

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
              <small>Virtual Campus</small>
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
          {showAdminLink && (
            <button
              type="button"
              className="nav-item-admin"
              onClick={goAdmin}
              title="Admin panel"
            >
              <span className="icon">⚙️</span>
              {!sidebarCollapsed && <span>Admin panel</span>}
            </button>
          )}
          <button
            type="button"
            className="nav-item-logout"
            onClick={handleLogout}
            title="Sign out"
          >
            <span className="icon">🚪</span>
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <div className="student-main-wrap">
        <header className="student-header">
          <div className="header-left">
            <button
              type="button"
              className="toggle-sidebar-btn"
              onClick={toggleSidebar}
              aria-label="Menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
              <span className="streak-text">{streak} days</span>
            </div>
            <button
              type="button"
              className="user-profile-chip"
              onClick={() => navigate('/app/perfil')}
              aria-label="My profile"
              title="My profile"
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="avatar-img"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <div
                  className="avatar-placeholder"
                  style={{ background: user?.avatarColor || '#0071BC' }}
                >
                  {fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="user-greeting">
                Hi, <strong>{fullName.split(' ')[0]}</strong>
              </span>
            </button>
          </div>
        </header>

        <main className="student-content">
          <Outlet />
        </main>

        <footer className="student-footer">
          <p>
            © 2026 <strong>Hopee English</strong> — Virtual English academy
          </p>
          <p className="footer-meta">
            Support: soporte@hopee-english.com · Mon–Fri 9:00–18:00
          </p>
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
