import React, { useEffect } from 'react';
import { useStudentLayout } from '../../context/StudentLayoutContext';

interface Props {
  title: string;
  description: string;
  icon: string;
}

export const PlaceholderPage: React.FC<Props> = ({ title, description, icon }) => {
  const { setHeaderTitle, clearHeaderTabs } = useStudentLayout();

  useEffect(() => {
    setHeaderTitle(title);
    clearHeaderTabs();
  }, [title, setHeaderTitle, clearHeaderTabs]);

  return (
    <div className="home-card" style={{ textAlign: 'center', padding: '48px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ color: '#1a237e' }}>{title}</h3>
      <p style={{ color: '#64748b', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>{description}</p>
    </div>
  );
};
