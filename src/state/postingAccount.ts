/**
 * Who plain text in a window posts as (WFE-281): the window's own account, else
 * the default of the feed it shows, else the global default, else the one
 * account there is. A key naming an account that is no longer signed in is
 * skipped as if unset. Pure: the answer reads the app state and changes nothing.
 */

import type { AppState } from './appState';
import { feedById } from './feeds';
import { accountByKey } from './selectors';
import type { StoredAccount } from '../accounts/accountStore';
import type { WindowState } from '../windows/model';

/** Who plain text in {@link win} posts as, and why. */
export type PostingAccount = {
  readonly account: StoredAccount;
  readonly source: 'window' | 'feed' | 'global' | 'only';
} | null;

/** The posting default of the feed {@link win} shows; null for any other window or no default. */
function feedDefault(state: AppState, win: WindowState): string | null {
  if (win.ref.kind !== 'feed' || win.ref.target === null) {
    return null;
  }
  return feedById(state.settings.feeds, win.ref.target)?.postAs ?? null;
}

/** Who plain text in {@link win} posts as, and why; null when nothing decides it. */
export function postingAccount(state: AppState, win: WindowState): PostingAccount {
  const own = accountByKey(state, win.ref.accountKey);
  if (own !== null) {
    return { account: own, source: 'window' };
  }
  const feed = accountByKey(state, feedDefault(state, win));
  if (feed !== null) {
    return { account: feed, source: 'feed' };
  }
  const global = accountByKey(state, state.settings.postAs);
  if (global !== null) {
    return { account: global, source: 'global' };
  }
  const [only, ...others] = state.accounts;
  return only !== undefined && others.length === 0 ? { account: only, source: 'only' } : null;
}
