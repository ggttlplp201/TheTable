import { defineConfig, devices } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5173';
const serverUrl = process.env.E2E_SERVER_URL ?? 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: './qa/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : [
    {
      command: `env HOST=127.0.0.1 PORT=3001 CLIENT_ORIGIN=${webUrl} pnpm --filter @the-table/server start`,
      url: `${serverUrl}/health/ready`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `env VITE_SERVER_URL=${serverUrl} pnpm --filter @the-table/web dev -- --host 127.0.0.1`,
      url: webUrl,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
