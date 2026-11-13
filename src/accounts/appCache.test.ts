/**
 * Tests for the per-instance app cache (decision 8) over the shared MSW
 * server, counting the registrations it actually sends: a miss registers once
 * and stores, the second call reads the cache without a request, another
 * redirect URI registers separately, a failed or corrupt entry registers
 * again, and forgetApp makes the next call re-register.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { forgetApp, getOrRegisterApp } from './appCache';
import type { ApiError } from '../api/errors';
import type { AppCredentials } from '../api/oauth';
import { type Result, ok } from '../lib/result';
import { type StorageBackend, createStore } from '../storage/store';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';
const REDIRECT_URI = `${ORIGIN}/auth/callback`;
const OTHER_REDIRECT_URI = `${ORIGIN}/login/callback`;
const APP_NAME = 'WiredFE';

/** The registration stored under one origin and redirect URI. */
const STORED_KEY = `wired:v1:apps:${ORIGIN} ${REDIRECT_URI}`;

const FIRST_APP: AppCredentials = { client_id: 'client-1', client_secret: 'secret-1' };
const SECOND_APP: AppCredentials = { client_id: 'client-2', client_secret: 'secret-2' };

/** An in-memory backend, so tests can inspect exactly what was stored. */
type FakeBackend = StorageBackend & { readonly entries: Map<string, string> };

function createFakeBackend(): FakeBackend {
  const entries = new Map<string, string>();

  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/**
 * Answers `POST /api/v1/apps` with fresh credentials on every call and counts
 * the requests it saw.
 */
function mockRegistration(): { readonly requests: () => number } {
  let count = 0;
  server.use(
    http.post(`${ORIGIN}/api/v1/apps`, () => {
      count += 1;
      return HttpResponse.json({
        id: String(count),
        name: APP_NAME,
        client_id: `client-${String(count)}`,
        client_secret: `secret-${String(count)}`,
      });
    }),
  );
  return { requests: () => count };
}

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<AppCredentials, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(getOrRegisterApp, () => {
  it('registers on a miss, stores the answer, and reuses it without a request', async () => {
    const backend = createFakeBackend();
    const store = createStore('apps', backend);
    const registration = mockRegistration();

    const first = await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });
    const second = await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });

    expect(first).toStrictEqual(ok(FIRST_APP));
    expect(second).toStrictEqual(ok(FIRST_APP));
    expect(registration.requests()).toBe(1);
    expect(backend.entries.get(STORED_KEY)).toStrictEqual(JSON.stringify(FIRST_APP));
  });

  it('reads a registration stored by another store over the same backend', async () => {
    const backend = createFakeBackend();
    const registration = mockRegistration();

    await getOrRegisterApp(createStore('apps', backend), {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });
    const afterReload = await getOrRegisterApp(createStore('apps', backend), {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: 'WiredFE again',
    });

    expect(afterReload).toStrictEqual(ok(FIRST_APP));
    expect(registration.requests()).toBe(1);
  });

  it('registers separately for another redirect URI', async () => {
    const backend = createFakeBackend();
    const store = createStore('apps', backend);
    const registration = mockRegistration();

    await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });
    const other = await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: OTHER_REDIRECT_URI,
      appName: APP_NAME,
    });

    expect(other).toStrictEqual(ok(SECOND_APP));
    expect(registration.requests()).toBe(2);
    expect(backend.entries.size).toBe(2);
  });

  it('returns the error of a failed registration and stores nothing', async () => {
    const backend = createFakeBackend();
    const store = createStore('apps', backend);
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, () =>
        HttpResponse.json({ error: 'Registration refused' }, { status: 422 }),
      ),
    );

    const failed = await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });

    expect(failureOf(failed)).toStrictEqual({
      kind: 'http',
      status: 422,
      message: 'Registration refused',
    });
    expect(backend.entries.size).toBe(0);
  });

  it('registers again when the stored value is not a valid client', async () => {
    const backend = createFakeBackend();
    const store = createStore('apps', backend);
    backend.entries.set(STORED_KEY, JSON.stringify({ client_id: 7 }));
    const registration = mockRegistration();

    const result = await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });

    expect(result).toStrictEqual(ok(FIRST_APP));
    expect(registration.requests()).toBe(1);
    expect(backend.entries.get(STORED_KEY)).toStrictEqual(JSON.stringify(FIRST_APP));
  });
});

describe(forgetApp, () => {
  it('drops the stored client so the next call registers again', async () => {
    const backend = createFakeBackend();
    const store = createStore('apps', backend);
    const registration = mockRegistration();

    await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });
    forgetApp(store, { origin: ORIGIN, redirectUri: REDIRECT_URI });
    const after = await getOrRegisterApp(store, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
    });

    expect(after).toStrictEqual(ok(SECOND_APP));
    expect(registration.requests()).toBe(2);
    expect(backend.entries.get(STORED_KEY)).toStrictEqual(JSON.stringify(SECOND_APP));
  });

  it('ignores a registration that was never cached', () => {
    const backend = createFakeBackend();
    const store = createStore('apps', backend);

    forgetApp(store, { origin: 'https://other.example', redirectUri: REDIRECT_URI });

    expect(backend.entries.size).toBe(0);
  });
});
