import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import '../styles/login.css';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginStudent, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate('/app/inicio', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      loginStudent({
        token: response.data.moodleToken,
        userId: response.data.userId,
        fullName: response.data.fullName,
      });
      setSuccess(true);
      setTimeout(() => navigate('/app/inicio'), 800);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message;
      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Could not connect to the server. Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-brand-side">
        <img
          src="/Iso-naranja-Hopee-Academy.png"
          alt="Hopee English Background"
          className="login-brand-bg-image"
        />
        <div className="login-brand-content">
          <h1>Welcome to Hopee Academy</h1>
          <p>
            The platform where your future has no limits. Sign in to continue your bilingual
            journey.
          </p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-form-container">
          <img src="/Logo-Hopee-Academy.png" alt="Logo Hopee English" className="login-logo" />
          <h2>Made to Learn and Thrive</h2>
          <p>Sign in to your virtual classroom.</p>

          {success && (
            <div className="login-alert success">
              <span>🎉</span> Login successful! Preparing your classroom...
            </div>
          )}

          {error && (
            <div className="login-alert error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-input-group">
              <label>Username / Email</label>
              <input
                type="text"
                className="login-input"
                placeholder="example@email.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>

            <div className="login-input-group">
              <label htmlFor="login-password">Password</label>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || success}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading || success}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login" disabled={loading || success}>
              {loading ? 'Validating credentials...' : 'Sign in '}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
