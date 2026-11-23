/**
 * Vitest setup: DOM matchers for every test, the MSW server, and a clean DOM
 * after each one.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { FakeSocket } from './fakeSocket';
import { server } from './server';

beforeEach(() => {
  FakeSocket.reset();
  vi.stubGlobal('WebSocket', FakeSocket);
});

beforeAll(() => {
  // MSW v3 renamed onUnhandledRequest to onUnhandledFrame; 'error' still
  // fails the test on any request no handler matches.
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
