/**
 * Tests for the selectors of signed-out windows (WFE-340): a signed-out key
 * gives a tokenless session of its origin and is the key a window loads with,
 * where a key of an account that is signed in is its own and a key of nobody
 * gives none.
 */
import { describe, expect, it } from 'vitest';

import { anonKey } from './anonAccount';
import { coreReducer, initialAppState } from './appState';
import { loadKeyFor, sessionFor } from './selectors';
import { accountKey } from '../accounts/accountStore';
import { type WindowRef, windowId } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ANON = anonKey(ORIGIN);
const LAIN = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'secret',
  refreshToken: null,
  expiresAt: null,
};

/** The state with lain signed in and a thread window of each of {@link keys} open. */
function withThreads(keys: readonly (string | null)[]) {
  const signedIn = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  return keys.reduce((state, key) => {
    const ref: WindowRef = { kind: 'thread', accountKey: key, target: '5' };
    return coreReducer(state, { type: 'windows', action: { type: 'open', ref, title: 't' } });
  }, signedIn);
}

describe('sessionFor a signed-out key', () => {
  it('is the origin with no token, whoever is signed in', () => {
    expect(sessionFor(withThreads([]), ANON)).toStrictEqual({ origin: ORIGIN, token: null });
  });

  it('is still the account’s own session for an account key', () => {
    expect(sessionFor(withThreads([]), LAIN.key)).toStrictEqual({
      origin: ORIGIN,
      token: 'secret',
    });
  });
});

describe(loadKeyFor, () => {
  it('is a signed-out window’s key', () => {
    const state = withThreads([ANON]);

    expect(loadKeyFor(state, windowId({ kind: 'thread', accountKey: ANON, target: '5' }))).toBe(
      ANON,
    );
  });

  it('is the key of an account that is signed in', () => {
    const state = withThreads([LAIN.key]);

    expect(loadKeyFor(state, windowId({ kind: 'thread', accountKey: LAIN.key, target: '5' }))).toBe(
      LAIN.key,
    );
  });

  it('is none for the key of an account that is gone, and for no window', () => {
    const gone = accountKey('https://gone.example', '9');
    const state = withThreads([gone]);

    expect(
      loadKeyFor(state, windowId({ kind: 'thread', accountKey: gone, target: '5' })),
    ).toBeNull();
    expect(loadKeyFor(state, 'nope')).toBeNull();
  });
});
