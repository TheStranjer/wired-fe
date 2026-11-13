/**
 * Tests for completing an OAuth login (decision 8) over the shared MSW
 * server. The stores hold a cached app and a pending login; an unmocked
 * request fails the test. Each behaviour answers the message it names.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { type AccountStore, type StoredAccount, createAccountStore } from './accountStore';
import { type LoginOutcome, completeLogin } from './completeLogin';
import {
  PENDING_LOGIN_TTL_MS,
  type PendingLogin,
  readPendingLogin,
  savePendingLogin,
} from './pendingLogin';
import type { AppCredentials } from '../api/oauth';
import { type StorageBackend, type Store, createStore } from '../storage/store';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';
const REDIRECT_URI = `${ORIGIN}/auth/callback`;
const APP_NAME = 'WiredFE';
const NOW = 1_700_000_000_000;
const STATE = '0123456789abcdef0123456789abcdef';
const CALLBACK = `?code=auth-code&state=${STATE}`;
const APP: AppCredentials = { client_id: 'client-abc', client_secret: 'secret-xyz' };
const ACCESS_TOKEN = 'token-lain';

const PENDING: PendingLogin = {
  origin: ORIGIN,
  state: STATE,
  redirectUri: REDIRECT_URI,
  createdAt: NOW,
};

/** The twelve fields every backend sends for an account (decision 7). */
const ACCOUNT_WIRE = {
  id: '109',
  username: 'lain',
  acct: 'lain',
  fqn: 'lain@wired.example',
  display_name: 'Lain',
  created_at: '2024-03-01T00:00:00.000Z',
  note: '<p>hi</p>',
  url: `${ORIGIN}/users/lain`,
  avatar: `${ORIGIN}/avi.png`,
  header: `${ORIGIN}/banner.png`,
  followers_count: 42,
  following_count: 17,
  statuses_count: 12,
};

/** The account the happy path stores. */
const STORED_LAIN: StoredAccount = {
  key: `${ORIGIN}#109`,
  origin: ORIGIN,
  accountId: '109',
  handle: 'lain@wired.example',
  token: ACCESS_TOKEN,
};

/** An in-memory storage backend. */
function createFakeBackend(): StorageBackend {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/** The three stores the flow reads. */
type Stores = {
  readonly apps: Store;
  readonly login: Store;
  readonly accounts: AccountStore;
};

/** Fresh stores: the pending login always, the cached app on ask. */
function makeStores(options?: { readonly app?: boolean; readonly pending?: boolean }): Stores {
  const stores: Stores = {
    apps: createStore('apps', createFakeBackend()),
    login: createStore('login', createFakeBackend()),
    accounts: createAccountStore(createStore('accounts', createFakeBackend())),
  };
  if (options?.app === true) {
    stores.apps.set(`${ORIGIN} ${REDIRECT_URI}`, APP);
  }
  if (options?.pending !== false) {
    savePendingLogin(stores.login, PENDING);
  }
  return stores;
}

/** Runs the flow at {@link now} with the build's app name. */
async function run(stores: Stores, search: string, now: number = NOW): Promise<LoginOutcome> {
  return completeLogin(stores, { search, appName: APP_NAME, now });
}

/** Answers the token exchange. */
function mockToken(): void {
  server.use(
    http.post(`${ORIGIN}/oauth/token`, () => HttpResponse.json({ access_token: ACCESS_TOKEN })),
  );
}

/** Answers `verify_credentials`; also proves it got the fresh token. */
function mockVerify(): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/accounts/verify_credentials`, ({ request }) => {
      expect(request.headers.get('Authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);

      return HttpResponse.json(ACCOUNT_WIRE);
    }),
  );
}

/** The error outcome's message. */
function messageOf(outcome: LoginOutcome): string {
  if (outcome.kind !== 'error') {
    expect.fail('expected the login to fail');
  }
  return outcome.message;
}

/** The ok outcome's account. */
function accountOf(outcome: LoginOutcome): StoredAccount {
  if (outcome.kind !== 'ok') {
    expect.fail('expected the login to succeed');
  }
  return outcome.account;
}

describe(completeLogin, () => {
  it('is none for a query that is no callback', async () => {
    const stores = makeStores({ app: true });

    const outcome = await run(stores, '?utm_source=matrix');

    expect(outcome).toStrictEqual({ kind: 'none' });
    expect(readPendingLogin(stores.login, NOW)).toStrictEqual(PENDING);
  });

  it('completes the login and stores the account active', async () => {
    mockToken();
    mockVerify();
    const stores = makeStores({ app: true });

    const outcome = await run(stores, CALLBACK);

    expect(accountOf(outcome)).toStrictEqual(STORED_LAIN);
    expect(stores.accounts.list()).toStrictEqual([STORED_LAIN]);
    expect(stores.accounts.activeKey()).toBe(STORED_LAIN.key);
    expect(readPendingLogin(stores.login, NOW)).toBeNull();
  });

  it('refuses the instance error callback', async () => {
    const stores = makeStores({ app: true });

    const outcome = await run(stores, '?error=access_denied&error_description=User%20denied');

    expect(messageOf(outcome)).toBe('Login refused: User denied');
    expect(readPendingLogin(stores.login, NOW)).toBeNull();
  });

  it('falls back to the bare error code', async () => {
    const stores = makeStores({ app: true });

    const outcome = await run(stores, '?error=invalid_request');

    expect(messageOf(outcome)).toBe('Login refused: invalid_request');
  });

  it('reports a login that was never started here', async () => {
    const stores = makeStores({ pending: false });

    const outcome = await run(stores, CALLBACK);

    expect(messageOf(outcome)).toBe('Login expired or was not started here. Try again.');
  });

  it('reports an expired pending login and leaves it stored', async () => {
    const stores = makeStores({ app: true });

    const outcome = await run(stores, CALLBACK, NOW + PENDING_LOGIN_TTL_MS + 1);

    expect(messageOf(outcome)).toBe('Login expired or was not started here. Try again.');
    expect(readPendingLogin(stores.login, NOW)).toStrictEqual(PENDING);
  });

  it('clears the pending login on a state mismatch', async () => {
    const stores = makeStores({ app: true });

    const outcome = await run(stores, `?code=auth-code&state=${'f'.repeat(32)}`);

    expect(messageOf(outcome)).toBe('Login state did not match. Try again.');
    expect(readPendingLogin(stores.login, NOW)).toBeNull();
  });

  it('fails on a refused registration', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, () =>
        HttpResponse.json({ error: 'Registration refused' }, { status: 422 }),
      ),
    );
    const stores = makeStores();

    const outcome = await run(stores, CALLBACK);

    expect(messageOf(outcome)).toBe('Login failed: HTTP 422: Registration refused');
    expect(readPendingLogin(stores.login, NOW)).toBeNull();
  });

  it('fails on a rejected grant', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, () =>
        HttpResponse.json({ error: 'invalid_grant' }, { status: 400 }),
      ),
    );
    const stores = makeStores({ app: true });

    const outcome = await run(stores, CALLBACK);

    expect(messageOf(outcome)).toBe('Login failed: HTTP 400: invalid_grant');
    expect(readPendingLogin(stores.login, NOW)).toBeNull();
  });

  it('fails on an unverifiable token', async () => {
    mockToken();
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/verify_credentials`, () =>
        HttpResponse.json({ error: 'The access token is invalid' }, { status: 401 }),
      ),
    );
    const stores = makeStores({ app: true });

    const outcome = await run(stores, CALLBACK);

    expect(messageOf(outcome)).toBe('Login failed: HTTP 401: The access token is invalid');
    expect(readPendingLogin(stores.login, NOW)).toBeNull();
    expect(stores.accounts.list()).toStrictEqual([]);
  });
});
