import React from 'react';
import { ForumView } from '@/features/forums/components/ForumView'; 

export const ForumPage: React.FC = () => {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <h1 style={{ marginBottom: '5px' }}>💬 Community Forum</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: '20px' }}>
        Welcome to the academy&apos;s shared space. Share your questions or insights here.
      </p>
      <ForumView /> 
    </div>
  );
};
