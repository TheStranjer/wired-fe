/**
 * Tests for the persisted account list and active-account pointer (decision
 * 8): insertion order, replace-in-place, the active rules, corrupt stored
 * data reading as empty, and every method re-reading the store.
 */

import { describe, expect, it } from 'vitest';

import {
  type AccountStore,
  type StoredAccount,
  accountKey,
  createAccountStore,
} from './accountStore';
import { type StorageBackend, createStore } from '../storage/store';

/** An in-memory backend over a Map, so tests can corrupt the raw values. */
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

function makeAccounts(): AccountStore {
  return createAccountStore(createStore('accounts', createFakeBackend()));
}

const LAIN: Omit<StoredAccount, 'key'> = {
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'tok-lain',
};

const ALICE: Omit<StoredAccount, 'key'> = {
  origin: 'https://pleroma.example',
  accountId: '9',
  handle: 'alice@pleroma.example',
  token: 'tok-alice',
};

const LAIN_KEY = accountKey(LAIN.origin, LAIN.accountId);
const ALICE_KEY = accountKey(ALICE.origin, ALICE.accountId);
const STORED_LAIN: StoredAccount = { key: LAIN_KEY, ...LAIN };
const STORED_ALICE: StoredAccount = { key: ALICE_KEY, ...ALICE };

describe(accountKey, () => {
  it('joins the origin and the account id with a hash', () => {
    expect(accountKey('https://wired.example', '42')).toBe('https://wired.example#42');
  });
});

describe(createAccountStore, () => {
  it('reads an empty list and no active account from an empty store', () => {
    const accounts = makeAccounts();

    expect(accounts.list()).toStrictEqual([]);
    expect(accounts.activeKey()).toBeNull();
  });

  it('returns the added account with its derived key', () => {
    const accounts = makeAccounts();

    expect(accounts.add(LAIN)).toStrictEqual(STORED_LAIN);
  });

  it('lists added accounts in insertion order with the last one active', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);
    accounts.add(ALICE);

    expect(accounts.list()).toStrictEqual([STORED_LAIN, STORED_ALICE]);
    expect(accounts.activeKey()).toBe(ALICE_KEY);
  });

  it('gets an account by key and undefined for an unknown key', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);

    expect(accounts.get(LAIN_KEY)).toStrictEqual(STORED_LAIN);
    expect(accounts.get('https://nowhere.example#1')).toBeUndefined();
  });

  it('replaces the same origin and id in place and makes it active', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);
    accounts.add(ALICE);
    accounts.add({ ...LAIN, token: 'rotated' });

    expect(accounts.list()).toStrictEqual([{ ...STORED_LAIN, token: 'rotated' }, STORED_ALICE]);
    expect(accounts.activeKey()).toBe(LAIN_KEY);
  });

  it('switches the active account and ignores unknown keys', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);
    accounts.add(ALICE);
    accounts.setActive(LAIN_KEY);

    expect(accounts.activeKey()).toBe(LAIN_KEY);

    accounts.setActive('https://nowhere.example#1');

    expect(accounts.activeKey()).toBe(LAIN_KEY);
  });

  it('makes the first remaining account active when the active one is removed', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);
    accounts.add(ALICE);
    accounts.remove(ALICE_KEY);

    expect(accounts.list()).toStrictEqual([STORED_LAIN]);
    expect(accounts.activeKey()).toBe(LAIN_KEY);
  });

  it('leaves the active pointer alone when another account is removed', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);
    accounts.add(ALICE);
    accounts.remove(LAIN_KEY);

    expect(accounts.list()).toStrictEqual([STORED_ALICE]);
    expect(accounts.activeKey()).toBe(ALICE_KEY);
  });

  it('has no active account once the last one is removed', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);
    accounts.remove(LAIN_KEY);

    expect(accounts.list()).toStrictEqual([]);
    expect(accounts.activeKey()).toBeNull();
  });

  it('ignores removing a key that is not listed', () => {
    const accounts = makeAccounts();

    accounts.add(LAIN);
    accounts.remove('https://nowhere.example#1');

    expect(accounts.list()).toStrictEqual([STORED_LAIN]);
    expect(accounts.activeKey()).toBe(LAIN_KEY);
  });

  it('reads an empty list when the stored list is not JSON', () => {
    const backend = createFakeBackend();
    const accounts = createAccountStore(createStore('accounts', backend));

    accounts.add(LAIN);
    backend.entries.set('wired:v1:accounts:list', 'not json');

    expect(accounts.list()).toStrictEqual([]);
    expect(accounts.activeKey()).toBeNull();
  });

  it('reads an empty list when the stored list fails its schema', () => {
    const backend = createFakeBackend();
    const store = createStore('accounts', backend);

    store.set('list', [{ origin: 'https://wired.example' }]);

    const accounts = createAccountStore(store);

    expect(accounts.list()).toStrictEqual([]);
    expect(accounts.get(LAIN_KEY)).toBeUndefined();
  });

  it('reads the active key as null when no listed account has it', () => {
    const backend = createFakeBackend();
    const store = createStore('accounts', backend);

    store.set('list', [STORED_LAIN]);
    store.set('active', 'https://gone.example#7');

    expect(createAccountStore(store).activeKey()).toBeNull();
  });

  it('shares one backend between stores because nothing is cached', () => {
    const backend = createFakeBackend();
    const first = createAccountStore(createStore('accounts', backend));
    const second = createAccountStore(createStore('accounts', backend));

    first.add(LAIN);

    expect(second.list()).toStrictEqual([STORED_LAIN]);
    expect(second.activeKey()).toBe(LAIN_KEY);

    second.remove(LAIN_KEY);

    expect(first.list()).toStrictEqual([]);
    expect(first.activeKey()).toBeNull();
  });
});
