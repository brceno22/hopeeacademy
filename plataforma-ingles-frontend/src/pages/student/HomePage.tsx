import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/context/AuthContext';
import { useMicrolearningToday } from '@/core/hooks/useMicrolearningToday';
import './home-page.css';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useMicrolearningToday();
  const streak = data?.currentStreak ?? 0;
  const firstName = (user?.fullName || 'Student').split(' ')[0];

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
