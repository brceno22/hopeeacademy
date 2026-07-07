import React from 'react';
import { useNavigate } from 'react-router-dom';

interface CourseProps {
  id: number;
  name: string;
  code: string;
  description: string;
}

export const CourseCard: React.FC<CourseProps> = ({ id, name, code, description }) => {
  const navigate = useNavigate();

  return (
    <div className="program-class-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <span style={{ 
          background: 'rgba(0, 113, 188, 0.1)', 
          color: 'var(--primary-color)', 
          padding: '4px 10px', 
          borderRadius: '8px', 
          fontSize: '0.75rem', 
          fontWeight: 'bold',
          display: 'inline-block',
          marginBottom: '12px'
        }}>
          {code}
        </span>
        <h4 style={{ margin: '0 0 8px 0' }}>{name}</h4>
        <p style={{ marginBottom: '20px' }}>{description}</p>
      </div>
      
      <button
        type="button"
        className="btn-card primary"
        onClick={() => navigate(`/app/cursos/${id}`)}
      >
        Entrar al curso
      </button>
    </div>
  );
};