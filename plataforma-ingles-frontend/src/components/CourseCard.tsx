import React from 'react';
import { useNavigate } from 'react-router-dom';

// Definimos qué datos necesita recibir cada tarjeta usando TypeScript
interface CourseProps {
  id: number;
  name: string;
  code: string;
  description: string;
}

export const CourseCard: React.FC<CourseProps> = ({ id, name, code, description }) => {
  
  const navigate = useNavigate();

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e1e4e6',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      transition: 'transform 0.2s',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div>
        <span style={{ 
          background: '#e3f2fd', 
          color: '#0d47a1', 
          padding: '4px 8px', 
          borderRadius: '6px', 
          fontSize: '12px', 
          fontWeight: 'bold' 
        }}>
          {code}
        </span>
        <h3 style={{ margin: '12px 0 8px 0', color: '#1a1a1a' }}>{name}</h3>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 16px 0' }}>{description}</p>
      </div>
      
      <button
        type="button"
        onClick={() => navigate(`/courses/${id}`)}
        style={{
          width: '100%',
          padding: '12px',
          background: '#1a237e',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        Entrar al curso
      </button>
        </div>
  );
};