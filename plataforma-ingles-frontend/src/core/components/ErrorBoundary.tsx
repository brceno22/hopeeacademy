//ErrorBoundary.tsx
import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '20px' }}>🛠️</div>
          <h2 style={{ color: 'var(--primary-color)', fontFamily: 'var(--font-titles)', marginBottom: '10px' }}>Algo no salió como esperábamos</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>{this.state.message}</p>
          <button
            type="button"
            className="btn-card primary"
            style={{ maxWidth: '200px', margin: '0 auto' }}
            onClick={() => window.location.assign('/')}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}