/// <reference types="vitest/config" />
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_DEV_TARGET = process.env.API_DEV_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The API is mounted on the same origin in development so the session
    // cookie stays first-party and SameSite=Lax applies as in production.
    proxy: {
      '/api': {
        target: API_DEV_TARGET,
        changeOrigin: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@access': path.resolve(__dirname, 'src/access'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@layout': path.resolve(__dirname, 'src/layout'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@context': path.resolve(__dirname, 'src/context'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@constants': path.resolve(__dirname, 'src/constants'),
      // What the API sends and accepts, shared with it (types only)
      '@contracts': path.resolve(__dirname, '../api/src/contracts'),
      '@styles': path.resolve(__dirname, 'src/styles'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) {
            return 'react-vendor';
          }

          if (id.includes('node_modules/lucide-react')) {
            return 'ui-vendor';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
});
