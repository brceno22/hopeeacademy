import React, { useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {

      const response = await api.post('/auth/login', { username, password });

      const token = response.data.moodleToken;
      
      localStorage.setItem('token', token);
      if (response.data.userId != null) {
        localStorage.setItem('moodleUserId', String(response.data.userId));
      }
      if (response.data.fullName) {
        localStorage.setItem('fullName', response.data.fullName);
      }
      
      setSuccess(true);
      setTimeout(() => navigate('/app/inicio'), 1000);

    } catch (err: any){

      setError(err.response?.data?.message || 'Error al conectar con el servidor');

    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'left' }}>
      <h2>Plataforma de Inglés - Login</h2>
      
      {success && <p style={{ color: 'green' }}>🎉 ¡Login Exitoso! Token guardado.</p>}
      {error && <p style={{ color: 'red' }}>⚠️ {error}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Usuario de Moodle:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Contraseña:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {loading ? 'Validando con Moodle...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  );
}

