/**
 * Tests for OAuth error callbacks (decision 8): one is shown only when its
 * `state` matches the pending login, and then only as a plain error code;
 * anything else is ignored and leaves the pending login alone. The
 * `error_description` the URL carries is never shown.
 */
import { describe, expect, it } from 'vitest';

import { createAccountStore } from './accountStore';
import { type LoginOutcome, completeLogin } from './completeLogin';
import { type PendingLogin, readPendingLogin, savePendingLogin } from './pendingLogin';
import { type StorageBackend, type Store, createStore } from '../storage/store';

const NOW = 1_700_000_000_000;
const STATE = '0123456789abcdef0123456789abcdef';
const PENDING: PendingLogin = {
  origin: 'https://wired.example',
  state: STATE,
  redirectUri: 'https://wired.example/auth/callback',
  createdAt: NOW,
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

/** The login store, holding {@link PENDING} unless asked not to. */
function loginStore(pending = true): Store {
  const login = createStore('login', createFakeBackend());
  if (pending) {
    savePendingLogin(login, PENDING);
  }
  return login;
}

/** Runs the flow over {@link login} for the query {@link search}. */
async function run(login: Store, search: string): Promise<LoginOutcome> {
  const stores = {
    apps: createStore('apps', createFakeBackend()),
    login,
    accounts: createAccountStore(createStore('accounts', createFakeBackend())),
  };
  return completeLogin(stores, { search, appName: 'WiredFE', now: NOW });
}

describe('completeLogin error callbacks', () => {
  it('refuses with the right state, naming only the error', async () => {
    const login = loginStore();

    const outcome = await run(
      login,
      `?error=access_denied&error_description=User%20denied&state=${STATE}`,
    );

    expect(outcome).toStrictEqual({ kind: 'error', message: 'Login refused (access_denied)' });
    expect(readPendingLogin(login, NOW)).toBeNull();
  });

  it.each(['has spaces', '<b>x</b>', 'UPPER', 'a'.repeat(65)])(
    'shows no error value that is not a plain code: %s',
    async (error) => {
      const login = loginStore();

      const outcome = await run(login, `?error=${encodeURIComponent(error)}&state=${STATE}`);

      expect(outcome).toStrictEqual({ kind: 'error', message: 'Login refused' });
      expect(readPendingLogin(login, NOW)).toBeNull();
    },
  );

  it('ignores an error without a state and keeps the pending login', async () => {
    const login = loginStore();

    const outcome = await run(login, '?error=x&error_description=evil.example');

    expect(outcome).toStrictEqual({ kind: 'ignored' });
    expect(readPendingLogin(login, NOW)).toStrictEqual(PENDING);
  });

  it('ignores an error with a wrong state and keeps the pending login', async () => {
    const login = loginStore();

    const outcome = await run(login, `?error=access_denied&state=${'f'.repeat(32)}`);

    expect(outcome).toStrictEqual({ kind: 'ignored' });
    expect(readPendingLogin(login, NOW)).toStrictEqual(PENDING);
  });

  it('ignores an error when no login is pending', async () => {
    const outcome = await run(loginStore(false), `?error=access_denied&state=${STATE}`);

    expect(outcome).toStrictEqual({ kind: 'ignored' });
  });
});
