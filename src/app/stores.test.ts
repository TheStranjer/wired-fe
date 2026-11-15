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
};

describe(appStores, () => {
  it('creates the four stores once and hands out that one value', () => {
    const stores = appStores();

    expect(appStores()).toBe(stores);
    expect(stores.apps).toBe(appStores().apps);
    expect(stores.login).toBe(appStores().login);
    expect(stores.accounts).toBe(appStores().accounts);
    expect(stores.settings).toBe(appStores().settings);
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
