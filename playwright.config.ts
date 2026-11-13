/**
 * Playwright end-to-end tests run against the production build (`dist/`),
 * served by `vite preview`, so they see the real CSP and bundle.
 * scripts/ci.sh builds first; Playwright starts and stops the server itself.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  fullyParallel: true,
  retries: 0,
  reporter: 'line',
  use: { baseURL: `http://127.0.0.1:${String(PORT)}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
