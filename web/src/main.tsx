import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import '@styles/tokens.css';
import '@styles/reset.css';
import '@styles/typography.css';

import { router } from './app/router';

// Every visitor starts on the sign-in screen. Warming that chunk at boot means
// the page paints on the first frame instead of flashing a loader first.
void import('@pages/auth/AuthPage');

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
);
