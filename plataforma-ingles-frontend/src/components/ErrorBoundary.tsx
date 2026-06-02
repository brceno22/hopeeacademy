import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ color: '#c62828' }}>Algo falló en la pantalla</h2>
          <p style={{ color: '#666' }}>{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            style={{ marginTop: '16px', padding: '10px 20px', cursor: 'pointer' }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
