/**
 * Tests for the application's persisted stores: they are created once and
 * shared, each namespace keeps its own values, and the accounts namespace really
 * is the account store on top of it.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { appStores } from './stores';
import { accountKey } from '../accounts/accountStore';

/** The account the stores test adds and takes away again. */
const ACCOUNT = {
  origin: 'https://wired.example',
  accountId: '7',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

describe(appStores, () => {
  it('creates the stores once and hands out that one value', () => {
    const stores = appStores();

    const again = appStores();

    expect(again).toBe(stores);
    expect([again.apps, again.login, again.accounts, again.settings, again.profiles]).toStrictEqual(
      [stores.apps, stores.login, stores.accounts, stores.settings, stores.profiles],
    );
  });

  it('keeps the instance profiles in the session, not in the persistent storage', () => {
    const { profiles } = appStores();

    expect(profiles.set('probe', 'session only')).toBe(true);
    expect(globalThis.sessionStorage.getItem('wired:v1:profiles:probe')).toBe('"session only"');
    expect(globalThis.localStorage.getItem('wired:v1:profiles:probe')).toBeNull();

    profiles.remove('probe');
  });

  it('keeps each namespace to itself', () => {
    const { apps, settings } = appStores();

    expect(apps.set('probe', 'apps only')).toBe(true);
    expect(apps.get('probe', v.string())).toBe('apps only');
    expect(settings.get('probe', v.string())).toBeUndefined();

    apps.remove('probe');

    expect(apps.get('probe', v.string())).toBeUndefined();
  });

  it('stores accounts through the account store', () => {
    const { accounts } = appStores();
    const added = accounts.add(ACCOUNT);

    expect(added.key).toBe(accountKey(ACCOUNT.origin, ACCOUNT.accountId));
    expect(appStores().accounts.get(added.key)).toStrictEqual(added);
    expect(accounts.activeKey()).toBe(added.key);

    accounts.remove(added.key);

    expect(accounts.list()).toStrictEqual([]);
  });
});
