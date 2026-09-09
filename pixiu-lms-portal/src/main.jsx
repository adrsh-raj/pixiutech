import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Portal Error Caught:', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  handleLoginRecovery = () => {
    try {
      localStorage.removeItem('pixiu_auth_token');
      localStorage.removeItem('pixiu_auth_refresh_token');
      localStorage.removeItem('pixiu_auth_user');
      Object.keys(localStorage).filter(key => key.startsWith('pixiu_') && key.includes(':')).forEach(key => localStorage.removeItem(key));
    } catch (e) {}
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0A1A33', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px', textAlign: 'center' }}>
          <div style={{ maxWidth: '500px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Pixiu Tech Portal Recovery</h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.6' }}>
              A page-level error occurred. Your application data has not been cleared.
            </p>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '11px', color: '#f87171', marginBottom: '20px', textAlign: 'left', overflowX: 'auto' }}>
              {this.state.error?.message || 'Unknown Client Exception'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button type="button" onClick={this.handleRetry} style={{ backgroundColor: '#1D6EFF', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>Reload</button>
              <button type="button" onClick={this.handleLoginRecovery} style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 18px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>Recover Session</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
