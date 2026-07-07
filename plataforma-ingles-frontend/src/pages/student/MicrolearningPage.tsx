import React from 'react';
import { MicrolearningWidget } from '@/features/microlearning/components/MicrolearningWidget';

export const MicrolearningPage: React.FC = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>⚡ Microlearning Diario</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        ¡Practicá un minuto cada día para mantener tu racha 🔥!
      </p>
      <MicrolearningWidget />
    </div>
  );
};