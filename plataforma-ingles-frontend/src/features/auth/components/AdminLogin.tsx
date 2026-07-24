import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/core/api/axios';
import { useAuth } from '@/core/context/AuthContext';
import '@/pages/admin/admin.css';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { loginAdmin, isAdmin } = useAuth();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) navigate('/admin/inicio', { replace: true });
  }, [isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.get('/courses/admin/moodle-courses', {
        headers: { 'x-admin-key': key },
      });
      loginAdmin(key);
      navigate('/admin/inicio');
    } catch {
      setError('Incorrect key or server unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <img
          src="/Logo-Hopee-Academy.png"
          alt="Hopee Academy"
          className="admin-login-card__logo"
        />
        <h1>Admin panel</h1>
        <p className="admin-login-card__sub">Sign in with the admin key.</p>

        {error && <div className="admin-alert err">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Access key
          </label>
          <input
            type="password"
            className="admin-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
            disabled={loading}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16, minWidth: 0 }}
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="admin-btn primary"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Validating…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
