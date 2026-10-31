import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:4100';

// Runs the real API (on a throwaway in-memory database) and the Vite dev server,
// then drives the site in the locally installed Chrome.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    baseURL: WEB_URL,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../api',
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        PORT: '4100',
        // Always a throwaway in-memory database, seeded by the API on startup,
        // even when api/.env points at a real PostgreSQL database.
        DATABASE_URL: ':memory:',
        // The suite registers more accounts than the sign-up limit allows.
        ENABLE_RATE_LIMIT: 'false',
        WEB_ORIGIN: WEB_URL,
        MAIL_TRANSPORT: 'console',
      },
    },
    {
      command: 'npm run dev',
      url: WEB_URL,
      reuseExistingServer: false,
      env: { API_DEV_TARGET: API_URL },
    },
  ],
});
