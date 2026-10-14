import { defineConfig, devices } from '@playwright/test';

/**
 * E2E_BASE_URL runs the suite against a deployed site, e.g.
 *   E2E_BASE_URL=https://sarielh.github.io/SkyRoute/ npm run test:e2e
 * Without it, the production build is served locally by `vite preview`.
 */
const remote = process.env.E2E_BASE_URL;
const baseURL = remote ?? 'http://localhost:4173/SkyRoute/';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
  webServer: remote
    ? undefined
    : { command: 'npx vite preview --port 4173 --strictPort', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
