/**
 * The `signedIn` action (WFE-243, decision 14): an account joined the running
 * session after startup. The first sign-in of all makes the `stream` feed and
 * shows it; a later one joins an automatic `stream`, or, when the reader has
 * edited it, prints the `/feed add` hint and opens the account's home and
 * notifications windows as before. Startup, which has no state to read, does
 * the same through ./streamFeed on its own (src/app/startupStream).
 */

import { rebindAnon } from './anonAccount';
import { withPrinted } from './appPrint';
import { mergedSettings, syncBuffers } from './appReducer';
import type { AppState } from './appState';
import { feedWindowOpen } from './feedWindow';
import { applyWindowsAction } from './layoutSync';
import type { SyncSlice } from './layoutSync';
import type { Settings } from './settings';
import { openStartupWindows } from './startupWindows';
import { joinStream, streamSeed } from './streamFeed';
import type { StoredAccount } from '../accounts/accountStore';
import { STATUS_WINDOW_ID } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** {@link account} has just signed in (its `accounts` action came first). */
export type SignInAction = {
  readonly type: 'signedIn';
  readonly account: StoredAccount;
  /** The moment, for the line a hint is printed as. */
  readonly date: Date;
};

/** {@link state} with {@link patch} laid over its settings. */
function withSettings(state: AppState, patch: Partial<Settings>): AppState {
  return { ...state, settings: mergedSettings(state.settings, patch) };
}

/** {@link state} after the window list took every one of {@link actions}, buffers brought along. */
function withOpened(state: AppState, actions: readonly WindowsAction[]): AppState {
  const start: SyncSlice = { windows: state.windows, layout: state.layout };
  const { windows, layout } = actions.reduce(applyWindowsAction, start);
  return { ...state, windows, layout, buffers: syncBuffers(windows.windows, state.buffers) };
}

/**
 * {@link state} with the signed-out windows of the origin {@link account} signed
 * in on rebound to it (./anonAccount): they become normal windows. The same
 * state when there are none.
 */
function withRebound(state: AppState, account: StoredAccount): AppState {
  const windows = rebindAnon(state.windows, account.origin, account.key);
  return windows === state.windows ? state : { ...state, windows };
}

/**
 * Make the account's way into the session: its origin's signed-out windows
 * become its own, then the stream, or the stream plus a hint, or its own
 * windows.
 */
export function signInReducer(state: AppState, action: SignInAction): AppState {
  return joinSession(withRebound(state, action.account), action);
}

/** Make the account's way into the session: the stream, or the stream plus a hint, or its own windows. */
function joinSession(state: AppState, action: SignInAction): AppState {
  const seed = streamSeed(state.settings, state.accounts);
  if (seed !== null) {
    const made = withSettings(state, { feeds: [seed], streamMade: true });
    return withOpened(made, [feedWindowOpen(seed)]);
  }
  const join = joinStream(state.settings.feeds, action.account);
  const joined = withSettings(state, { feeds: join.feeds });
  const told =
    join.hint === null
      ? joined
      : withPrinted(joined, {
          windowId: STATUS_WINDOW_ID,
          date: action.date,
          level: 'info',
          text: join.hint,
        });
  return join.joined
    ? told
    : withOpened(told, openStartupWindows([action.account], state.activeAccountKey));
}
