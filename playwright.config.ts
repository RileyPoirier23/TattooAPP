import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const dataDir = path.join(os.tmpdir(), `inkspace-e2e-${Date.now()}`);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/mock-square.mjs', port: 4999, reuseExistingServer: false },
    {
      command: 'node dist/server.js',
      url: 'http://127.0.0.1:4173/health',
      reuseExistingServer: false,
      env: {
        PORT: '4173',
        DATA_DIR: dataDir,
        APP_URL: 'http://127.0.0.1:4173',
        ADMIN_EMAIL: 'admin@example.com',
        ADMIN_PASSWORD: 'admin-password',
        SQUARE_API_BASE: 'http://127.0.0.1:4999',
        SQUARE_ACCESS_TOKEN: 'test',
        SQUARE_APPLICATION_ID: 'sandbox-sq0idb-test',
        SQUARE_LOCATION_ID: 'L1',
        DISABLE_JOBS: 'true',
      },
    },
  ],
});
