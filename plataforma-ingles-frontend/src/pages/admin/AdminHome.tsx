import React from 'react';
import { useNavigate } from 'react-router-dom';
import '@/pages/admin/admin.css';

const MODULES = [
  {
    to: '/admin/carpetas',
    icon: '📁',
    title: 'Folders / program',
    desc: 'Organize the Hopee program and assign Moodle courses.',
  },
  {
    to: '/admin/grabaciones',
    icon: '🎬',
    title: 'Recorded classes',
    desc: 'Add Drive links associated with each folder/class.',
  },
  {
    to: '/admin/calendario',
    icon: '📅',
    title: 'Calendar',
    desc: 'Shifts, student assignment, and one-off events.',
  },
  {
    to: '/admin/microlearning',
    icon: '⚡',
    title: 'Microlearning',
    desc: 'Create daily pills or upload a bulk JSON.',
  },
  {
    to: '/admin/examenes',
    icon: '📝',
    title: 'Exams',
    desc: 'Manage exams and questions on the platform.',
  },
];

export const AdminHome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Admin panel</h1>
        <p>Choose a module to manage the Hopee campus.</p>
      </header>

      <div className="admin-hub-grid">
        {MODULES.map((m) => (
          <button
            key={m.to}
            type="button"
            className="admin-hub-card"
            onClick={() => navigate(m.to)}
          >
            <span className="admin-hub-card__icon" aria-hidden>
              {m.icon}
            </span>
            <h2>{m.title}</h2>
            <p>{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
