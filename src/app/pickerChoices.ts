/**
 * What both modes of the account picker (./useAccountPicker, WFE-282, WFE-284)
 * build their box from: the feed a window shows, the account to start on, the
 * accounts as radio choices, the remember scopes, and the one transition that
 * saves a default. Plain functions over the app state, so the hook stays small.
 */

import type { LineRestorer } from './useLineRestoreApi';
import type { Translate } from '../i18n/messages';
import type { AppState } from '../state/appState';
import { type FeedSpec, feedById } from '../state/feeds';
import { postingAccount } from '../state/postingAccount';
import { postingPatch } from '../state/postingDefault';
import type { RefreshDeps } from '../state/refreshSession';
import type { Dispatch } from '../state/StateContext';
import type { WindowState } from '../windows/model';

/** What the box of any purpose needs: the state, the way to change it, the token refresh and the way back to the command line. */
export type PickerContext = {
  readonly state: AppState;
  readonly dispatch: Dispatch;
  readonly refresh: RefreshDeps;
  readonly restore: LineRestorer;
  /** Words the box in the language in use. */
  readonly t: Translate;
};

/** The scope value that posts this one draft and remembers nothing. */
export const ONCE_SCOPE = 'once';

/** The scope value that remembers the choice for the feed the window shows. */
export const FEED_SCOPE = 'feed';

/** The scope value that remembers the choice for every window. */
export const GLOBAL_SCOPE = 'global';

/** The feed the window shows, when it shows one that is still saved. */
export function feedOf(state: AppState, win: WindowState): FeedSpec | null {
  if (win.ref.kind !== 'feed' || win.ref.target === null) {
    return null;
  }
  return feedById(state.settings.feeds, win.ref.target) ?? null;
}

/** The key of the account to start on: who the window posts as now, else the active account, else the first. */
export function startKey(state: AppState, win: WindowState): string | null {
  const current = postingAccount(state, win)?.account.key;
  return current ?? state.activeAccountKey ?? state.accounts.at(0)?.key ?? null;
}

/** The signed-in accounts as the dialog lists them. */
export function accountChoices(state: AppState): readonly { key: string; label: string }[] {
  return state.accounts.map((account) => ({ key: account.key, label: `@${account.handle}` }));
}

/** The remember scopes for {@link feed}: the feed's own when there is one, and everywhere. */
export function rememberScopes(
  feed: FeedSpec | null,
  t: Translate,
): readonly { value: string; label: string }[] {
  return [
    ...(feed === null
      ? []
      : [{ value: FEED_SCOPE, label: t('app.scope_this_feed', { name: feed.name }) }]),
    { value: GLOBAL_SCOPE, label: t('app.scope_everywhere') },
  ];
}

/** Make {@link key} the default of {@link feed} when it is not null, else the global default. */
export function saveDefault(
  context: { readonly state: AppState; readonly dispatch: Dispatch },
  feed: FeedSpec | null,
  key: string,
): void {
  const patch = postingPatch(context.state.settings.feeds, feed?.id ?? null, key);
  context.dispatch({ type: 'settings', settings: patch });
}
