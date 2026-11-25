/**
 * The desk the persistence tests share (decision 17): two signed-in accounts,
 * four windows (one with display overrides) and two desktops, one holding a
 * tree of two panes and a float. Built with the real reducer, so the state is
 * one the app can reach. Test wiring only; no assertion lives here.
 */
import { accountKey } from '../accounts/accountStore';
import type { StoredAccount } from '../accounts/accountStore';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import type { AppAction } from '../state/reducer';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

/** Signs in as {@link handle} on {@link origin}. */
function accountOn(origin: string, id: string, handle: string): StoredAccount {
  return {
    key: accountKey(origin, id),
    origin,
    accountId: id,
    handle,
    token: `token-${id}`,
    refreshToken: null,
    expiresAt: null,
  };
}

export const LAIN = accountOn('https://a.example', '1', 'lain@a.example');
export const BOB = accountOn('https://b.example', '2', 'bob@b.example');

/** Lain's home, Bob's home, a thread of Lain's and a feed no account owns. */
const LAIN_HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };
const BOB_HOME: WindowRef = { kind: 'home', accountKey: BOB.key, target: null };
const THREAD: WindowRef = { kind: 'thread', accountKey: LAIN.key, target: '42' };
const FEED: WindowRef = { kind: 'feed', accountKey: null, target: 'main' };

/** The ids those windows have. */
export const LAIN_HOME_ID = windowId(LAIN_HOME);
export const BOB_HOME_ID = windowId(BOB_HOME);
export const THREAD_ID = windowId(THREAD);
export const FEED_ID = windowId(FEED);

/** An `open` action for {@link ref}. */
function open(ref: WindowRef, title: string): AppAction {
  return { type: 'windows', action: { type: 'open', ref, title } };
}

/** The actions that build the desk, in order. */
const BUILD: readonly AppAction[] = [
  { type: 'accounts', accounts: [LAIN, BOB], activeKey: LAIN.key },
  open(LAIN_HOME, 'home'),
  open(BOB_HOME, 'home/bob'),
  open(THREAD, 'thread/a3'),
  open(FEED, 'main'),
  {
    type: 'windows',
    action: { type: 'setDisplay', id: THREAD_ID, overrides: { density: 'lines', images: false } },
  },
  // Desktop 1: row(p1:feed p2:lain-home), then p2 split into column(p2:lain-home p3:bob-home), p3 floated.
  { type: 'layout', action: { type: 'split', dir: 'row', windowId: LAIN_HOME_ID } },
  { type: 'layout', action: { type: 'split', dir: 'column', windowId: BOB_HOME_ID } },
  { type: 'layout', action: { type: 'float' } },
  // Desktop 2: one pane showing the thread; back to desktop 1 and its float.
  { type: 'layout', action: { type: 'goToDesktop', n: 2 } },
  { type: 'layout', action: { type: 'split', dir: 'row', windowId: THREAD_ID } },
  { type: 'layout', action: { type: 'goToDesktop', n: 1 } },
];

/** The desk those actions build. */
export function builtDesk(): AppState {
  return BUILD.reduce(appReducer, initialAppState());
}
