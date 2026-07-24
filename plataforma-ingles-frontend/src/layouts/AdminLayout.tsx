import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/context/AuthContext';
import '@/pages/admin/admin.css';

const NAV = [
  { to: '/admin/inicio', label: 'Home', icon: '🏠' },
  { to: '/admin/carpetas', label: 'Folders / program', icon: '📁' },
  { to: '/admin/grabaciones', label: 'Recorded classes', icon: '🎬' },
  { to: '/admin/calendario', label: 'Calendar', icon: '📅' },
  { to: '/admin/microlearning', label: 'Microlearning', icon: '⚡' },
  { to: '/admin/examenes', label: 'Exams', icon: '📝' },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { logoutAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin');
  };

  const goCampus = () => {
    navigate('/app/inicio');
  };

  return (
    <div className={`admin-app ${collapsed ? 'admin-app--collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <img src="/Iso-naranja-Hopee-Academy.png" alt="" className="admin-sidebar__logo" />
          {!collapsed && (
            <div className="admin-sidebar__brand-text">
              <strong>Hopee Academy</strong>
              <small>Admin panel</small>
            </div>
          )}
        </div>

        <nav className="admin-sidebar__nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `admin-sidebar__link${isActive ? ' active' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="admin-sidebar__icon" aria-hidden>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <button
            type="button"
            className="admin-sidebar__campus"
            onClick={goCampus}
            title="Back to campus"
          >
            {collapsed ? '🎓' : '← Back to campus'}
          </button>
          <button
            type="button"
            className="admin-sidebar__toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? '»' : '«'}
          </button>
          <button type="button" className="admin-btn danger admin-sidebar__logout" onClick={handleLogout}>
            {collapsed ? '⎋' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-main__inner">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
