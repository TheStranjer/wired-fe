/**
 * Tests for which accounts the app state calls expired: an `accountExpired`
 * action marks one (and says nothing new the second time), and the account
 * list moving on clears the mark of an account that left or whose token was
 * replaced while keeping the mark of one that is unchanged.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import type { StoredAccount } from '../accounts/accountStore';

const ORIGIN = 'https://wired.example';

/** An account with {@link token}; the key names it. */
function account(accountId: string, token: string): StoredAccount {
  return {
    key: `${ORIGIN}#${accountId}`,
    origin: ORIGIN,
    accountId,
    handle: `user${accountId}@wired.example`,
    token,
    refreshToken: null,
    expiresAt: null,
  };
}

/** A state signed in as {@link accounts} with the first of them expired. */
function expiredFirst(accounts: readonly StoredAccount[]): AppState {
  const [first] = accounts;
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts,
    activeKey: first?.key ?? null,
  });
  return coreReducer(signed, { type: 'accountExpired', accountKey: first?.key ?? '' });
}

describe('expired accounts', () => {
  it('starts with none and marks an account once', () => {
    const first = account('1', 'a');
    const state = expiredFirst([first]);

    expect(initialAppState().expired.size).toBe(0);
    expect([...state.expired]).toStrictEqual([first.key]);
    expect(coreReducer(state, { type: 'accountExpired', accountKey: first.key }).expired).toBe(
      state.expired,
    );
  });

  it('keeps the mark of an unchanged account, and the very same state', () => {
    const accounts = [account('1', 'a'), account('2', 'b')];
    const state = expiredFirst(accounts);

    const next = coreReducer(state, {
      type: 'accounts',
      accounts,
      activeKey: accounts[0]?.key ?? null,
    });

    expect(next).toBe(state);
  });

  it('clears the mark of an account whose token was replaced', () => {
    const state = expiredFirst([account('1', 'a')]);

    const next = coreReducer(state, {
      type: 'accounts',
      accounts: [account('1', 'b')],
      activeKey: state.activeAccountKey,
    });

    expect(next.expired.size).toBe(0);
  });

  it('clears the mark of an account that left', () => {
    const state = expiredFirst([account('1', 'a'), account('2', 'b')]);

    const next = coreReducer(state, {
      type: 'accounts',
      accounts: [account('2', 'b')],
      activeKey: null,
    });

    expect(next.expired.size).toBe(0);
  });
});
