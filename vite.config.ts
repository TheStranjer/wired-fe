import { existsSync, readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { cspPlugin } from './tooling/csp.ts';
import { configPath, loadConfig } from './tooling/loadConfig.ts';

// The build-time configuration (decision 3), loaded once and injected into
// the bundle as a constant; the tests run against the same value.
const wiredConfig = loadConfig(configPath(import.meta.dirname, process.env, existsSync), (path) =>
  readFileSync(path, 'utf8'),
);

export default defineConfig({
  define: { __WIRED_CONFIG__: JSON.stringify(wiredConfig) },
  // Relative asset URLs, so the build can be hosted under any path.
  base: './',
  plugins: [react(), cspPlugin()],
  build: {
    target: 'es2024',
    // The deliverable is index.html plus one JS and one CSS file.
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: false,
        entryFileNames: 'wired.[hash].js',
        assetFileNames: 'wired.[hash][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tooling/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    allowOnly: false,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/app/main.tsx'],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
