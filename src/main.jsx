import React, { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerPWA } from './utils/pwa';
import './index.css';
import App from './App.jsx';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: '#fda4af', background: '#0b0e14', minHeight: '100dvh', fontSize: 13 }}>
          <h3 style={{ marginBottom: 8 }}>অ্যাপ লোড করতে সমস্যা হয়েছে</h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', fontSize: 11 }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

registerPWA();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
