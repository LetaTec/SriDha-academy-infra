import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { z } from 'zod';

import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import '@styles/tokens.css';
import '@styles/reset.css';
import '@styles/typography.css';

import { redirectToCanonicalHost } from './app/canonicalHost';
import { preloadPriceFonts } from './app/preloadPriceFonts';
import { router } from './app/router';

// Every visitor starts on the sign-in screen. Warming that chunk at boot means
// the page paints on the first frame instead of flashing a loader first.
void import('@pages/auth/AuthPage');

// The site's Content-Security-Policy forbids eval. Without this, zod probes
// for eval at start-up and every page load reports a (harmless) violation.
z.config({ jitless: true });

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

if (!redirectToCanonicalHost()) {
  preloadPriceFonts();

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </React.StrictMode>,
  );
}
