import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/core/context/AuthContext';
import { AppQueryProvider } from '@/core/query/QueryProvider';
import App from './App.tsx';
import './index.css';
import './core/ui/ui.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppQueryProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppQueryProvider>
  </StrictMode>,
);
