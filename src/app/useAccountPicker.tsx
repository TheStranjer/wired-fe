/**
 * The account picker of the shell (WFE-282, WFE-284): while the state holds an
 * open {@link AccountPick}, the modal box that asks it, built from the app
 * state. The default mode is answered through the same settings transition
 * `/postas <handle>` uses (src/state/postingDefault), with the same
 * confirmation line; the post mode (./postPicker) posts a waiting draft. A route
 * overlay that is already open keeps the keyboard: the picker waits until
 * that box closes, as the error alert does. Root renders what the hook hands
 * back, and learns from it whether the picker is up, so an alert can wait.
 */

import type { JSX } from 'react';

import {
  FEED_SCOPE,
  GLOBAL_SCOPE,
  type PickerContext,
  accountChoices,
  feedOf,
  rememberScopes,
  saveDefault,
  startKey,
} from './pickerChoices';
import { postPicker } from './postPicker';
import type { LineRestorer } from './useLineRestoreApi';
import type { AccountPick } from '../state/accountPick';
import { printAction } from '../state/appState';
import type { FeedSpec } from '../state/feeds';
import { postingLine, postingSetLine } from '../state/postingDefault';
import { useRefreshDeps } from '../state/RefreshContext';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { AccountPickerDialog } from '../ui/AccountPickerDialog';

/** Save {@link key} as the default of {@link scope}, say so, and close the picker. */
function answer(
  context: PickerContext,
  pick: { readonly windowId: string },
  choice: { readonly feed: FeedSpec | null; readonly key: string; readonly scope: string },
): void {
  const { state, dispatch } = context;
  const target = choice.scope === FEED_SCOPE ? choice.feed : null;
  for (const account of state.accounts.filter((one) => one.key === choice.key)) {
    saveDefault(context, target, account.key);
    const line = postingSetLine(target?.name ?? null, account.handle);
    dispatch(printAction(pick.windowId, 'info', line));
  }
  dispatch({ type: 'closeAccountPick' });
}

/** The box that asks which account the window of {@link pick} posts as by default, or null when that cannot be asked. */
function defaultPicker(
  context: PickerContext,
  pick: { readonly windowId: string },
): JSX.Element | null {
  const { state, dispatch } = context;
  const win = state.windows.windows.find((one) => one.id === pick.windowId);
  const selected = win === undefined ? null : startKey(state, win);
  if (win === undefined || selected === null) {
    return null;
  }
  const feed = feedOf(state, win);
  return (
    <AccountPickerDialog
      accounts={accountChoices(state)}
      description={postingLine(state, win) ?? 'No posting account set'}
      onCancel={() => {
        dispatch({ type: 'closeAccountPick' });
      }}
      onSubmit={(key, scope) => {
        answer(context, pick, { feed, key, scope });
      }}
      scope={feed === null ? GLOBAL_SCOPE : FEED_SCOPE}
      scopes={rememberScopes(feed)}
      selected={selected}
      title="Post as"
    />
  );
}

/** The box for {@link pick}, whatever its purpose; a switch, so a purpose added to {@link AccountPick} does not compile until it has its box. */
function boxFor(context: PickerContext, pick: AccountPick): JSX.Element | null {
  switch (pick.purpose) {
    case 'default':
      return defaultPicker(context, pick);
    case 'post':
      return postPicker(context, pick);
  }
}

/** The box for the open question, or null while none is open or another modal holds the keyboard. */
export function useAccountPicker(
  otherModalOpen: boolean,
  restore: LineRestorer,
): JSX.Element | null {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const { accountPick } = state;
  if (accountPick === null || otherModalOpen) {
    return null;
  }
  return boxFor({ state, dispatch, refresh, restore }, accountPick);
}
