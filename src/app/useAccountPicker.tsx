/**
 * The account picker of the shell (WFE-282): while the state holds an open
 * {@link AccountPick}, the modal box that asks it, built from the app state
 * and answered through the same settings transition `/postas <handle>` uses
 * (src/state/postingDefault), with the same confirmation line. A route
 * overlay that is already open keeps the keyboard: the picker waits until
 * that box closes, as the error alert does. Root renders what the hook hands
 * back, and learns from it whether the picker is up, so an alert can wait.
 */

import type { JSX } from 'react';

import type { AccountPick } from '../state/accountPick';
import { type AppState, printAction } from '../state/appState';
import { type FeedSpec, feedById } from '../state/feeds';
import { postingAccount } from '../state/postingAccount';
import { postingLine, postingPatch, postingSetLine } from '../state/postingDefault';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';
import { AccountPickerDialog } from '../ui/AccountPickerDialog';
import type { WindowState } from '../windows/model';

/** The scope value that remembers the choice for the feed the window shows. */
const FEED_SCOPE = 'feed';

/** The scope value that remembers the choice for every window. */
const GLOBAL_SCOPE = 'global';

/** The feed the window shows, when it shows one that is still saved. */
function feedOf(state: AppState, win: WindowState): FeedSpec | null {
  if (win.ref.kind !== 'feed' || win.ref.target === null) {
    return null;
  }
  return feedById(state.settings.feeds, win.ref.target) ?? null;
}

/** The key of the account to start on: who the window posts as now, else the active account, else the first. */
function startKey(state: AppState, win: WindowState): string | null {
  const current = postingAccount(state, win)?.account.key;
  return current ?? state.activeAccountKey ?? state.accounts.at(0)?.key ?? null;
}

/** Save {@link key} as the default of {@link scope}, say so, and close the picker. */
function answer(
  context: { readonly state: AppState; readonly dispatch: Dispatch; readonly pick: AccountPick },
  feed: FeedSpec | null,
  choice: { readonly key: string; readonly scope: string },
): void {
  const { state, dispatch, pick } = context;
  const target = choice.scope === FEED_SCOPE ? feed : null;
  for (const account of state.accounts.filter((one) => one.key === choice.key)) {
    const patch = postingPatch(state.settings.feeds, target?.id ?? null, account.key);
    dispatch({ type: 'settings', settings: patch });
    const line = postingSetLine(target?.name ?? null, account.handle);
    dispatch(printAction(pick.windowId, 'info', line));
  }
  dispatch({ type: 'closeAccountPick' });
}

/** The box that asks which account the window of {@link pick} posts as, or null when that cannot be asked. */
function defaultPicker(state: AppState, dispatch: Dispatch, pick: AccountPick): JSX.Element | null {
  const win = state.windows.windows.find((one) => one.id === pick.windowId);
  const selected = win === undefined ? null : startKey(state, win);
  if (win === undefined || selected === null) {
    return null;
  }
  const feed = feedOf(state, win);
  return (
    <AccountPickerDialog
      accounts={state.accounts.map((account) => ({
        key: account.key,
        label: `@${account.handle}`,
      }))}
      description={postingLine(state, win) ?? 'No posting account set'}
      onCancel={() => {
        dispatch({ type: 'closeAccountPick' });
      }}
      onSubmit={(key, scope) => {
        answer({ state, dispatch, pick }, feed, { key, scope });
      }}
      scope={feed === null ? GLOBAL_SCOPE : FEED_SCOPE}
      scopes={[
        ...(feed === null ? [] : [{ value: FEED_SCOPE, label: `For this feed (~${feed.name})` }]),
        { value: GLOBAL_SCOPE, label: 'Everywhere' },
      ]}
      selected={selected}
      title="Post as"
    />
  );
}

/**
 * The box of each purpose a picker can have. A record keyed by `purpose`, so a
 * purpose added to {@link AccountPick} does not compile until it has its box.
 */
const PICKERS: Record<
  AccountPick['purpose'],
  (state: AppState, dispatch: Dispatch, pick: AccountPick) => JSX.Element | null
> = {
  default: defaultPicker,
};

/** The box for the open question, or null while none is open or another modal holds the keyboard. */
export function useAccountPicker(otherModalOpen: boolean): JSX.Element | null {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { accountPick } = state;
  if (accountPick === null || otherModalOpen) {
    return null;
  }
  return PICKERS[accountPick.purpose](state, dispatch, accountPick);
}
