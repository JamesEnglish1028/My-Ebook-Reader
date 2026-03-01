import React from 'react';

import ReactDOM from 'react-dom/client';

import App from './App';
import { ConfirmProvider } from './components/ConfirmContext';
import { ToastProvider } from './components/toast/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import './styles/ui-theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);
