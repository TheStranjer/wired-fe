/**
 * Tests for the pending login store: the save/read round trip over the exact
 * storage key, the TTL edge (still valid exactly at it, gone one millisecond
 * later), absent and corrupt values reading as null, and clear removing the
 * entry so a finished or abandoned login leaves nothing behind.
 */
import { describe, expect, it } from 'vitest';

import {
  PENDING_LOGIN_TTL_MS,
  type PendingLogin,
  clearPendingLogin,
  readPendingLogin,
  savePendingLogin,
} from './pendingLogin';
import { type StorageBackend, createStore } from '../storage/store';

const ORIGIN = 'https://wired.example';
const REDIRECT_URI = `${ORIGIN}/auth/callback`;
const STATE = '0123456789abcdef0123456789abcdef';
const CREATED_AT = 1_700_000_000_000;

const PENDING: PendingLogin = {
  origin: ORIGIN,
  state: STATE,
  redirectUri: REDIRECT_URI,
  createdAt: CREATED_AT,
};

/** What the `login` store keeps the pending login as. */
const STORED_KEY = 'wired:v1:login:pending';

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

describe(savePendingLogin, () => {
  it('stores the pending login under the store\'s "pending" key', () => {
    const backend = createFakeBackend();
    const store = createStore('login', backend);

    savePendingLogin(store, PENDING);

    expect(backend.entries.get(STORED_KEY)).toStrictEqual(JSON.stringify(PENDING));
  });

  it('replaces an older pending login', () => {
    const backend = createFakeBackend();
    const store = createStore('login', backend);
    const other: PendingLogin = { ...PENDING, state: 'ffff', createdAt: CREATED_AT + 1 };

    savePendingLogin(store, PENDING);
    savePendingLogin(store, other);

    expect(readPendingLogin(store, CREATED_AT + 1)).toStrictEqual(other);
    expect(backend.entries.size).toBe(1);
  });
});

describe(readPendingLogin, () => {
  it('reads back what was saved', () => {
    const store = createStore('login', createFakeBackend());
    savePendingLogin(store, PENDING);

    expect(readPendingLogin(store, CREATED_AT)).toStrictEqual(PENDING);
  });

  it('returns null when nothing was ever saved', () => {
    const store = createStore('login', createFakeBackend());

    expect(readPendingLogin(store, CREATED_AT)).toBeNull();
  });

  it('keeps the pending login valid exactly at the TTL', () => {
    const store = createStore('login', createFakeBackend());
    savePendingLogin(store, PENDING);

    expect(readPendingLogin(store, CREATED_AT + PENDING_LOGIN_TTL_MS)).toStrictEqual(PENDING);
  });

  it('drops the pending login one millisecond past the TTL', () => {
    const store = createStore('login', createFakeBackend());
    savePendingLogin(store, PENDING);

    expect(readPendingLogin(store, CREATED_AT + PENDING_LOGIN_TTL_MS + 1)).toBeNull();
  });

  it('returns null for a value that is not JSON', () => {
    const backend = createFakeBackend();
    backend.entries.set(STORED_KEY, '{not json');

    expect(readPendingLogin(createStore('login', backend), CREATED_AT)).toBeNull();
  });

  it('returns null for a JSON value with the wrong shape', () => {
    const backend = createFakeBackend();
    backend.entries.set(
      STORED_KEY,
      JSON.stringify({ origin: 5, state: STATE, redirectUri: REDIRECT_URI }),
    );

    expect(readPendingLogin(createStore('login', backend), CREATED_AT)).toBeNull();
  });

  it('returns null when createdAt is not a number', () => {
    const backend = createFakeBackend();
    backend.entries.set(STORED_KEY, JSON.stringify({ ...PENDING, createdAt: 'yesterday' }));

    expect(readPendingLogin(createStore('login', backend), CREATED_AT)).toBeNull();
  });
});

describe(clearPendingLogin, () => {
  it('removes the stored pending login', () => {
    const backend = createFakeBackend();
    const store = createStore('login', backend);
    savePendingLogin(store, PENDING);

    clearPendingLogin(store);

    expect(backend.entries.size).toBe(0);
    expect(readPendingLogin(store, CREATED_AT)).toBeNull();
  });

  it('ignores a pending login that was never stored', () => {
    const backend = createFakeBackend();

    clearPendingLogin(createStore('login', backend));

    expect(backend.entries.size).toBe(0);
  });
});
