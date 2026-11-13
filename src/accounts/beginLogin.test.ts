/**
 * Tests for starting a login: createState hex-encodes exactly the 16 bytes
 * its random source was handed (and 32 hex characters from the real one),
 * authorizeUrl carries every authorization-code parameter correctly encoded,
 * and beginLogin registers through the app cache, saves the pending login
 * whose state it puts in the URL, and propagates a registration failure with
 * nothing saved.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { authorizeUrl, beginLogin, createState } from './beginLogin';
import { PENDING_LOGIN_TTL_MS, readPendingLogin } from './pendingLogin';
import type { ApiError } from '../api/errors';
import { OAUTH_SCOPES } from '../api/oauth';
import type { Result } from '../lib/result';
import { type Store, type StorageBackend, createStore } from '../storage/store';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';
const REDIRECT_URI = `${ORIGIN}/auth/callback`;
const APP_NAME = 'WiredFE';
const NOW = 1_700_000_000_000;

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

/** The two stores beginLogin needs, over fresh in-memory backends. */
function createStores(): {
  readonly apps: Store;
  readonly login: Store;
  readonly loginBackend: FakeBackend;
} {
  const loginBackend = createFakeBackend();

  return {
    apps: createStore('apps', createFakeBackend()),
    login: createStore('login', loginBackend),
    loginBackend,
  };
}

/** Answers `POST /api/v1/apps` with one client. */
function mockRegistration(): void {
  server.use(
    http.post(`${ORIGIN}/api/v1/apps`, () =>
      HttpResponse.json({ client_id: 'cid-1', client_secret: 'csecret-1' }),
    ),
  );
}

/** The authorize URL a successful result carries, failing on the error one. */
function urlOf(result: Result<string, ApiError>): string {
  if (!result.ok) {
    expect.fail('expected beginLogin to succeed');
  }
  return result.value;
}

describe(createState, () => {
  it('hex-encodes the 16 bytes its random source was given', () => {
    const bytes = [
      0x00, 0x01, 0x0a, 0x0f, 0x10, 0x63, 0x9a, 0xab, 0xc0, 0xde, 0xef, 0xf0, 0xf9, 0xfa, 0xff,
      0x80,
    ];
    let receivedLength = 0;

    const state = createState((buffer) => {
      receivedLength = buffer.length;
      buffer.set(bytes);
      return buffer;
    });

    expect(receivedLength).toBe(16);
    expect(state).toBe('00010a0f10639aabc0deeff0f9faff80');
  });

  it('draws 32 lowercase hex characters from crypto by default', () => {
    const first = createState();
    const second = createState();

    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });
});

describe(authorizeUrl, () => {
  it('points at the instance authorize page', () => {
    const raw = authorizeUrl({
      origin: ORIGIN,
      clientId: 'cid-1',
      redirectUri: REDIRECT_URI,
      state: 'st1te',
    });

    expect(raw.startsWith(`${ORIGIN}/oauth/authorize?`)).toBe(true);
  });

  it('carries every code-flow parameter', () => {
    const raw = authorizeUrl({
      origin: ORIGIN,
      clientId: 'cid-1',
      redirectUri: REDIRECT_URI,
      state: '0123456789abcdef0123456789abcdef',
    });

    const url = new URL(raw);

    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('cid-1');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('scope')).toBe(OAUTH_SCOPES);
    expect(url.searchParams.get('state')).toBe('0123456789abcdef0123456789abcdef');
  });

  it('encodes parameters that carry reserved characters', () => {
    const tricky = 'a&b c+d/e=f';

    const raw = authorizeUrl({
      origin: ORIGIN,
      clientId: 'id&1',
      redirectUri: `${REDIRECT_URI}?x=1 2`,
      state: tricky,
    });

    expect(raw).not.toMatch(/\s/);
    expect(raw).toContain('scope=read+write+follow+push');

    const url = new URL(raw);

    expect(url.searchParams.get('client_id')).toBe('id&1');
    expect(url.searchParams.get('redirect_uri')).toBe(`${REDIRECT_URI}?x=1 2`);
    expect(url.searchParams.get('state')).toBe(tricky);
  });
});

describe(beginLogin, () => {
  /** Runs one login against the mocked instance and returns its URL. */
  async function startLogin(stores: ReturnType<typeof createStores>): Promise<URL> {
    const raw = urlOf(
      await beginLogin(stores, {
        origin: ORIGIN,
        redirectUri: REDIRECT_URI,
        appName: APP_NAME,
        now: NOW,
      }),
    );
    return new URL(raw);
  }

  it('sends the registered client to the authorize page with the code-flow parameters', async () => {
    mockRegistration();
    const stores = createStores();

    const url = await startLogin(stores);

    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('cid-1');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('saves a random state as the pending login and returns it in the URL', async () => {
    mockRegistration();
    const stores = createStores();

    const url = await startLogin(stores);

    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);
    expect(readPendingLogin(stores.login, NOW)).toStrictEqual({
      origin: ORIGIN,
      state: url.searchParams.get('state'),
      redirectUri: REDIRECT_URI,
      createdAt: NOW,
    });
    expect(readPendingLogin(stores.login, NOW + PENDING_LOGIN_TTL_MS + 1)).toBeNull();
  });

  it('propagates a registration failure and saves nothing', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, () =>
        HttpResponse.json({ error: 'Registration refused' }, { status: 422 }),
      ),
    );
    const stores = createStores();

    const result = await beginLogin(stores, {
      origin: ORIGIN,
      redirectUri: REDIRECT_URI,
      appName: APP_NAME,
      now: NOW,
    });

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 422, message: 'Registration refused' },
    });
    expect(stores.loginBackend.entries.size).toBe(0);
  });
});
