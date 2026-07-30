import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import { useMicrolearningToday } from '@/core/hooks/useMicrolearningToday';
import './home-page.css';

type ClassStatus = 'upcoming' | 'live' | 'done';

interface TeacherTodayClass {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetUrl: string | null;
  shiftId: number;
  shiftName: string;
  folderName: string | null;
  status: ClassStatus;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<ClassStatus, string> = {
  upcoming: 'Upcoming',
  live: 'Live',
  done: 'Done',
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useMicrolearningToday();
  const streak = data?.currentStreak ?? 0;
  const firstName = (user?.fullName || 'Student').split(' ')[0];

  const [teacherClasses, setTeacherClasses] = useState<TeacherTodayClass[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: rows } = await api.get<TeacherTodayClass[]>('/calendar/teacher/today');
        if (!cancelled) setTeacherClasses(rows);
      } catch {
        if (!cancelled) setTeacherClasses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-container">
      <section className="welcome-banner">
        <div className="welcome-text">
          <h1>Welcome back, {firstName}! 👋</h1>
          <p>Ready to master English today? A world of possibilities is waiting for you.</p>
        </div>
        <div className="welcome-badge">
          <span className="flag-bubble">🇬🇧</span>
        </div>
      </section>

      {teacherClasses.length > 0 && (
        <section className="teacher-today">
          <div className="teacher-today__header">
            <h2>Your classes today</h2>
            <p>Classrooms you teach today — join Meet and take attendance.</p>
          </div>
          <ul className="teacher-today__list">
            {teacherClasses.map((c) => (
              <li
                key={c.id}
                className={`teacher-today__item teacher-today__item--${c.status}`}
              >
                <div className="teacher-today__main">
                  <div className="teacher-today__title-row">
                    <strong>{c.shiftName}</strong>
                    <span className={`teacher-today__badge teacher-today__badge--${c.status}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="teacher-today__meta">
                    {c.folderName ? `${c.folderName} · ` : ''}
                    {formatTime(c.startsAt)} – {formatTime(c.endsAt)}
                    {c.title ? ` · ${c.title}` : ''}
                  </p>
                </div>
                <div className="teacher-today__actions">
                  {c.meetUrl ? (
                    <a
                      className="btn-card primary teacher-today__btn"
                      href={c.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Join class
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn-card secondary teacher-today__btn"
                    onClick={() => navigate(`/app/asistencia?shiftId=${c.shiftId}`)}
                  >
                    Take attendance
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="home-grid">
        <div className="home-card action-card">
          <div className="card-header-icon orange-bg">⚡</div>
          <h3>Your daily streak</h3>
          <p className="streak-counter">
            🔥{' '}
            <span>
              {streak} {streak === 1 ? 'day' : 'days'} in a row
            </span>
          </p>
          <p className="card-desc">
            Keep the momentum going. Complete today&apos;s microlearning challenge in about 5 minutes.
          </p>
          <button
            type="button"
            className="btn-card primary"
            onClick={() => navigate('/app/microlearning')}
          >
            Practice now
          </button>
        </div>

        <div className="home-card">
          <div className="card-header-icon blue-bg">📚</div>
          <h3>My active courses</h3>
          <p className="card-desc">
            Jump straight into your classes, interactive materials, and Moodle content.
          </p>
          <button
            type="button"
            className="btn-card secondary"
            onClick={() => navigate('/app/cursos')}
          >
            Go to my courses
          </button>
        </div>

        <div className="home-card">
          <div className="card-header-icon purple-bg">💬</div>
          <h3>Community forum</h3>
          <p className="card-desc">
            Stuck on a grammar rule or vocabulary? Ask your classmates.
          </p>
          <button
            type="button"
            className="btn-card secondary"
            onClick={() => navigate('/app/foro')}
          >
            Enter the forum
          </button>
        </div>
      </div>

      <section className="tip-of-the-day">
        <div className="tip-icon">💡</div>
        <div className="tip-content">
          <h4>Study tip of the day</h4>
          <p>
            &quot;Consistency beats talent. Ten minutes every day beats a four-hour marathon on the
            weekend. Make your microlearning count!&quot;
          </p>
        </div>
      </section>
    </div>
  );
};
