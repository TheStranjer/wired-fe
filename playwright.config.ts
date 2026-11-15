/**
 * Playwright end-to-end tests run against the production build (`dist/`),
 * served by `vite preview`, so they see the real CSP and bundle.
 * scripts/ci.sh builds first; Playwright starts and stops the server itself.
 * Where Playwright's own Chromium has never been downloaded, the suite runs
 * on a locally installed one instead: every assertion is the browser's own
 * doing, and the workflow's `playwright install` keeps CI on the pinned build.
 */
import { existsSync } from 'node:fs';

import { chromium, defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** Distribution-packaged Chromium and Chrome, in the order a Linux box has them. */
const SYSTEM_BROWSERS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
];

/** Playwright's bundled browser, if it was ever installed; else the first
 * system browser; else nothing, and Playwright itself says what to do. */
function systemFallback(): string | undefined {
  if (existsSync(chromium.executablePath())) {
    return undefined;
  }
  return SYSTEM_BROWSERS.find((path) => existsSync(path));
}

const fallback = systemFallback();

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  fullyParallel: true,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: 'retain-on-failure',
    ...(fallback === undefined ? {} : { launchOptions: { executablePath: fallback } }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
