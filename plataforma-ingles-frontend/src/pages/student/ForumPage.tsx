import React from 'react';
import { ForumView } from '@/features/forums/components/ForumView'; 

export const ForumPage: React.FC = () => {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <h1 style={{ marginBottom: '5px' }}>💬 Foro de la Comunidad</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: '20px' }}>
        Bienvenidos al espacio común de la academia. Compartí tus dudas o aportes acá.
      </p>
      {/* Lo llamamos limpio, sin pasarle ninguna propiedad */}
      <ForumView /> 
    </div>
  );
};