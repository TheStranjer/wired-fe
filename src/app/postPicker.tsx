/**
 * The account picker in post mode (WFE-284): a draft was typed in a window with
 * no account of its own and nobody could be resolved to post it, so the box
 * asks which account sends it and how long the choice lasts. OK posts the draft
 * as the chosen account through the path `/as` confirms with, after saving the
 * default when the choice reaches past this post; a failed post prints its
 * error and puts the text back on the command line, and so does Cancel.
 */

import type { JSX } from 'react';

import {
  FEED_SCOPE,
  ONCE_SCOPE,
  type PickerContext,
  accountChoices,
  feedOf,
  rememberScopes,
  saveDefault,
  startKey,
} from './pickerChoices';
import { buildPostContext } from './postContext';
import { printAction } from '../state/appState';
import type { Draft } from '../state/draft';
import { postAsAccount } from '../state/postAsWindowAccount';
import { AccountPickerDialog } from '../ui/AccountPickerDialog';
import type { WindowState } from '../windows/model';

/** The longest quote of the draft the box shows before it cuts the text with `…`. */
const QUOTE_LENGTH = 60;

/** The text of {@link draft} in quotes, cut to about {@link QUOTE_LENGTH} characters. */
function quoted(draft: Draft): string {
  const text = draft.text;
  const cut = text.length > QUOTE_LENGTH ? `${text.slice(0, QUOTE_LENGTH - 1)}…` : text;
  return `“${cut}”`;
}

/** Put the draft's text back on the line, or print it as info when the reader has typed something there since. */
function giveBack(context: PickerContext, windowId: string, draft: Draft): void {
  if (!context.restore(draft.text)) {
    context.dispatch(printAction(windowId, 'info', `Not posted: ${draft.text}`));
  }
}

/** Close the box, save the default the scope asks for, and post the draft as {@link key}. */
async function send(
  context: PickerContext,
  pick: { readonly windowId: string; readonly draft: Draft },
  choice: { readonly key: string; readonly scope: string; readonly win: WindowState },
): Promise<void> {
  const { state, dispatch } = context;
  const { windowId, draft } = pick;
  dispatch({ type: 'closeAccountPick' });
  if (choice.scope !== ONCE_SCOPE) {
    saveDefault(
      context,
      choice.scope === FEED_SCOPE ? feedOf(state, choice.win) : null,
      choice.key,
    );
  }
  const post = buildPostContext(state, dispatch, context.refresh);
  const error = await postAsAccount(post, { accountKey: choice.key, windowId, draft });
  if (error !== null) {
    dispatch(printAction(windowId, 'error', error));
    giveBack(context, windowId, draft);
  }
}

/** The box for a draft waiting in the window {@link pick} names, or null when that window or every account is gone. */
export function postPicker(
  context: PickerContext,
  pick: { readonly windowId: string; readonly draft: Draft },
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
      description={quoted(pick.draft)}
      onCancel={() => {
        dispatch({ type: 'closeAccountPick' });
        giveBack(context, pick.windowId, pick.draft);
      }}
      onSubmit={(key, scope) => {
        void send(context, pick, { key, scope, win });
      }}
      scope={ONCE_SCOPE}
      scopes={[{ value: ONCE_SCOPE, label: 'Just this post' }, ...rememberScopes(feed)]}
      selected={selected}
      title="Post as"
    />
  );
}
