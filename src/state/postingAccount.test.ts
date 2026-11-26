/**
 * Tests for postingAccount (WFE-281): the order the window's own account, its
 * feed's default, the global default and the only account answer in, and that
 * a key naming an account no longer signed in is skipped as if unset.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState, type AppState } from './appState';
import type { FeedSpec } from './feeds';
import { postingAccount } from './postingAccount';
import { appReducer } from './reducer';
import { ALICE, LAIN } from '../test/splitDesk';
import type { WindowRef, WindowState } from '../windows/model';

const FEED: FeedSpec = { id: 'f1', name: 'main', sources: [], postAs: ALICE.key };
const STATUS_WINDOW: WindowState = {
  id: 'status',
  ref: { kind: 'status', accountKey: null, target: null },
  title: 'status',
  unread: 0,
  highlight: false,
  display: {},
};
const GONE = 'https://gone.example#9';

/** A window showing {@link ref}. */
function windowOf(ref: WindowRef): WindowState {
  return { id: 'w', ref, title: 'w', unread: 0, highlight: false, display: {} };
}

/** The window of the feed {@link id}. */
function feedWindow(id: string): WindowState {
  return windowOf({ kind: 'feed', accountKey: null, target: id });
}

/** A session signed in as {@link accounts} with {@link feeds} and the global default {@link postAs}. */
function session(
  accounts: readonly (typeof LAIN)[],
  feeds: readonly FeedSpec[] = [],
  postAs: string | null = null,
): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts,
    activeKey: accounts[0]?.key ?? null,
  });
  return appReducer(signedIn, { type: 'settings', settings: { feeds, postAs } });
}

describe(postingAccount, () => {
  it("posts as the window's own account before anything else", () => {
    const state = session([LAIN, ALICE], [FEED], LAIN.key);
    const win = windowOf({ kind: 'home', accountKey: LAIN.key, target: null });

    expect(postingAccount(state, win)).toStrictEqual({ account: LAIN, source: 'window' });
  });

  it("posts as a feed window's feed default before the global one", () => {
    const state = session([LAIN, ALICE], [FEED], LAIN.key);

    expect(postingAccount(state, feedWindow('f1'))).toStrictEqual({
      account: ALICE,
      source: 'feed',
    });
  });

  it('falls to the global default for a feed with no default of its own', () => {
    const state = session([LAIN, ALICE], [{ ...FEED, postAs: undefined }], LAIN.key);

    expect(postingAccount(state, feedWindow('f1'))).toStrictEqual({
      account: LAIN,
      source: 'global',
    });
  });

  it('falls to the global default for a feed that is not saved, and for a window with no feed', () => {
    const state = session([LAIN, ALICE], [], LAIN.key);

    expect(postingAccount(state, feedWindow('f9'))?.source).toBe('global');
    expect(
      postingAccount(state, windowOf({ kind: 'feed', accountKey: null, target: null }))?.source,
    ).toBe('global');
    expect(postingAccount(state, STATUS_WINDOW)).toStrictEqual({ account: LAIN, source: 'global' });
  });

  it('ignores a feed default for a window that is not a feed', () => {
    const state = session([LAIN, ALICE], [FEED]);
    const win = windowOf({ kind: 'status', accountKey: null, target: 'f1' });

    expect(postingAccount(state, win)).toBeNull();
  });

  it('posts as the one account there is when nothing else decides', () => {
    expect(postingAccount(session([LAIN]), STATUS_WINDOW)).toStrictEqual({
      account: LAIN,
      source: 'only',
    });
  });

  it('answers nobody with several accounts and no default, or with none at all', () => {
    expect(postingAccount(session([LAIN, ALICE]), STATUS_WINDOW)).toBeNull();
    expect(postingAccount(session([]), STATUS_WINDOW)).toBeNull();
  });

  it('skips a stale window, feed or global key as if it were unset', () => {
    const feeds = [{ ...FEED, postAs: GONE }];
    const state = session([LAIN, ALICE], feeds, GONE);
    const stale = windowOf({ kind: 'home', accountKey: GONE, target: null });

    expect(postingAccount(state, stale)).toBeNull();
    expect(postingAccount(state, feedWindow('f1'))).toBeNull();
    expect(postingAccount(session([LAIN], feeds, GONE), feedWindow('f1'))?.source).toBe('only');
  });

  it('reaches the global default past a stale feed default', () => {
    const state = session([LAIN, ALICE], [{ ...FEED, postAs: GONE }], ALICE.key);

    expect(postingAccount(state, feedWindow('f1'))).toStrictEqual({
      account: ALICE,
      source: 'global',
    });
  });
});
