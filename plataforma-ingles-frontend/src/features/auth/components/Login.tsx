//login.tsx
import React, { useState } from 'react';
import api from '@/core/api/axios';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css'; // Asegurate de que la ruta sea correcta

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
      setError(err.response?.data?.message || 'Error al conectar con el servidor. Revisá tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      
      {/* LADO IZQUIERDO: IMAGEN DE LA EMPRESA (Se oculta en celulares) */}
      <div className="login-brand-side">
        {/* 
          🔴 INSTRUCCIÓN PARA IMAGEN DE FONDO: 
          Descomentá la línea de abajo y poné el nombre de tu foto de la academia. 
        */}
          <img src="/Iso-naranja-Hopee-Academy.png" alt="Hopee English Background" className="login-brand-bg-image" /> 
        
        <div className="login-brand-content">
          <h1>Welcome to Hopee Academy</h1>
          <p>La plataforma donde tu futuro no tiene límites. Ingresa para continuar tu camino bilingüe.</p>
        </div>
      </div>

      {/* LADO DERECHO: FORMULARIO */}
      <div className="login-form-side">
        <div className="login-form-container">
          
          {/* 
            🔴 INSTRUCCIÓN PARA EL LOGO: 
            Descomentá la línea de abajo y poné el nombre del logo de la empresa.
          */}
          <img src="/Logo-Hopee-Academy.png" alt="Logo Hopee English" className="login-logo" /> 
          
          <h2>Made to Learn and Thrive</h2>
          <p>Inicia sesión en tu aula virtual.</p>

          {success && (
            <div className="login-alert success">
              <span>🎉</span> ¡Login Exitoso! Preparando el aula...
            </div>
          )}
          
          {error && (
            <div className="login-alert error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-input-group">
              <label>Usuario / Email</label>
              <input
                type="text"
                className="login-input"
                placeholder="ejemplo@correo.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>

            <div className="login-input-group">
              <label>Contraseña</label>
              <input
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>

            <button type="submit" className="btn-login" disabled={loading || success}>
              {loading ? 'Validando credenciales...' : 'Ingresar al sistema 🚀'}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};