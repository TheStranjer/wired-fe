import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { cspPlugin } from './tooling/csp.ts';

export default defineConfig({
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
