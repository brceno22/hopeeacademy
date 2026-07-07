import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key === 'clave_super_secreta_2026') {
      localStorage.setItem('adminKey', key);
      navigate('/admin/dashboard');
    } else {
      setError('Clave incorrecta');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '12px', fontFamily: 'system-ui' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>🔐 Panel Admin</h2>
      {error && <p style={{ color: 'red', background: '#fce4ec', padding: '10px', borderRadius: '6px' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Clave de acceso:</label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '20px' }}
        />
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#1a237e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
          Ingresar
        </button>
      </form>
    </div>
  );
};