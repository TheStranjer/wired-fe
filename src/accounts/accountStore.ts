/**
 * The persisted account list and active-account pointer (decision 8). Tokens
 * live in the storage layer under two namespaced keys of the given
 * {@link Store}: `list`, an array of {@link StoredAccount} validated against a
 * valibot schema on every read (invalid data reads as an empty list), and
 * `active`, the key of the current account, which reads as null when it names
 * an account that is no longer listed. Nothing is cached in memory, so two
 * tabs sharing one backend stay consistent enough. Nothing here logs, so
 * tokens can never reach a console.
 */

import * as v from 'valibot';

import type { Store } from '../storage/store';

/** One signed-in account: where it lives, who it is, and its token. */
export type StoredAccount = {
  /** `${origin}#${accountId}`; unique across instances (decision 8). */
  readonly key: string;
  /** The instance origin, e.g. `https://wired.example`. */
  readonly origin: string;
  /** The account's id on that instance. */
  readonly accountId: string;
  /** `lain@wired.example`, no leading `@`. */
  readonly handle: string;
  /** The OAuth access token. Never logged. */
  readonly token: string;
};

/** The persisted list of accounts plus the active-account pointer. */
export type AccountStore = {
  /** Accounts in insertion order; empty when the stored list is invalid. */
  readonly list: () => readonly StoredAccount[];
  /** The account with this key, or undefined. */
  readonly get: (key: string) => StoredAccount | undefined;
  /** Adds or replaces (same key) and makes it active. */
  readonly add: (account: Omit<StoredAccount, 'key'>) => StoredAccount;
  /** Removes; if it was active, the first remaining account becomes active (or none). */
  readonly remove: (key: string) => void;
  /** The active account's key, or null when there is none or it is stale. */
  readonly activeKey: () => string | null;
  /** Ignored for unknown keys. */
  readonly setActive: (key: string) => void;
};

/** One account as stored: exactly the {@link StoredAccount} fields. */
const StoredAccountSchema = v.strictObject({
  key: v.string(),
  origin: v.string(),
  accountId: v.string(),
  handle: v.string(),
  token: v.string(),
});

/** The `list` value; anything else fails and reads as empty. */
const AccountListSchema = v.array(StoredAccountSchema);

/** The `active` value: a key or null. */
const ActiveKeySchema = v.nullable(v.string());

/** The two keys this module owns within its {@link Store}. */
const LIST_KEY = 'list';
const ACTIVE_KEY = 'active';

/**
 * The stable key of an account: instance origin plus account id (decision 8).
 */
export function accountKey(origin: string, accountId: string): string {
  return `${origin}#${accountId}`;
}

/** Rebuilds a stored record from its fields, deriving the key; drops extras. */
function toStoredAccount(input: Omit<StoredAccount, 'key'>): StoredAccount {
  return {
    key: accountKey(input.origin, input.accountId),
    origin: input.origin,
    accountId: input.accountId,
    handle: input.handle,
    token: input.token,
  };
}

/** Replaces the same-key account in place, or appends a new one. */
function upsert(accounts: readonly StoredAccount[], account: StoredAccount): StoredAccount[] {
  const index = accounts.findIndex((existing) => existing.key === account.key);
  if (index === -1) {
    return [...accounts, account];
  }
  return accounts.map((existing, position) => (position === index ? account : existing));
}

/**
 * An {@link AccountStore} over one {@link Store} namespace. Every method
 * re-reads the store, so the account list survives page reloads and stays
 * consistent enough between two tabs on one backend.
 */
export function createAccountStore(store: Store): AccountStore {
  const list = (): readonly StoredAccount[] => store.get(LIST_KEY, AccountListSchema) ?? [];

  const get = (key: string): StoredAccount | undefined =>
    list().find((account) => account.key === key);

  const activeKey = (): string | null => {
    const active = store.get(ACTIVE_KEY, ActiveKeySchema);
    if (active === null || active === undefined) {
      return null;
    }
    return list().some((account) => account.key === active) ? active : null;
  };

  const add = (input: Omit<StoredAccount, 'key'>): StoredAccount => {
    const account = toStoredAccount(input);
    store.set(LIST_KEY, upsert(list(), account));
    store.set(ACTIVE_KEY, account.key);
    return account;
  };

  const remove = (key: string): void => {
    const current = list();
    const remaining = current.filter((account) => account.key !== key);
    if (remaining.length === current.length) {
      return;
    }
    const wasActive = activeKey() === key;
    store.set(LIST_KEY, remaining);
    if (wasActive) {
      const next = remaining[0];
      store.set(ACTIVE_KEY, next === undefined ? null : next.key);
    }
  };

  const setActive = (key: string): void => {
    if (get(key) !== undefined) {
      store.set(ACTIVE_KEY, key);
    }
  };

  return { list, get, add, remove, activeKey, setActive };
}
