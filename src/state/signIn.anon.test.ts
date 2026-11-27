/**
 * Tests for the sign-in of an account on an origin a visitor is reading
 * signed out (WFE-340): every `anon:<origin>` window of that origin is rebound
 * to the account, keeping its id, and becomes a normal window; windows of
 * other origins stay signed out.
 */
import { describe, expect, it } from 'vitest';

import { anonKey } from './anonAccount';
import { type AppState, initialAppState } from './appState';
import { type AppAction, appReducer } from './reducer';
import { LAIN } from '../test/deskFixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const NOW = new Date('2026-11-25T10:00:00.000Z');
const HERE: WindowRef = { kind: 'thread', accountKey: anonKey(LAIN.origin), target: '5' };
const ELSEWHERE: WindowRef = {
  kind: 'thread',
  accountKey: anonKey('https://other.example'),
  target: '5',
};

/** A visitor reading both threads signed out. */
function visitor(): AppState {
  return [HERE, ELSEWHERE].reduce(
    (state, ref) =>
      appReducer(state, { type: 'windows', action: { type: 'open', ref, title: 'thread/5' } }),
    initialAppState(),
  );
}

/** {@link state} after lain signs in, as `adoptAccount` does: the account list first, then the news of it. */
function signedIn(state: AppState): AppState {
  const actions: readonly AppAction[] = [
    { type: 'accounts', accounts: [LAIN], activeKey: LAIN.key },
    { type: 'signedIn', account: LAIN, date: NOW },
  ];
  return actions.reduce(appReducer, state);
}

/** The account key of the window with {@link ref}'s id in {@link state}. */
function keyOf(state: AppState, ref: WindowRef): string | null | undefined {
  return state.windows.windows.find((win) => win.id === windowId(ref))?.ref.accountKey;
}

describe('signing in on the origin of a signed-out window', () => {
  it('rebinds its signed-out windows to the account, keeping the id', () => {
    expect(keyOf(signedIn(visitor()), HERE)).toBe(LAIN.key);
  });

  it('leaves a signed-out window of another origin alone', () => {
    expect(keyOf(signedIn(visitor()), ELSEWHERE)).toBe(ELSEWHERE.accountKey);
  });
});
