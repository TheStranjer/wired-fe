/**
 * Posting from a window that belongs to no account (WFE-284): a feed, the
 * status window, and a people window that watches one. Plain text there posts
 * as whoever {@link postingAccount} resolves, at once, with the `posted as
 * @handle` line `/as` prints. A draft that carries media goes out as the
 * active account instead, because pending media are uploaded as it. When
 * nobody resolves, the account picker opens in post mode holding the draft and
 * nothing is posted yet; the handler resolves null either way, and the picker's
 * answer posts through {@link postAsAccount} too.
 */

import type { Draft } from './draft';
import { postAsAccount, postAsWindowAccount } from './postAsWindowAccount';
import { postingAccount } from './postingAccount';
import type { WindowKindDefinition } from './windowKind';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';

/** Whether {@link draft} carries uploaded media. */
function hasMedia(draft: Draft): boolean {
  return (draft.mediaIds?.length ?? 0) > 0;
}

/**
 * The post handler of the windows with no account of their own: posts as the
 * active account when the draft has media, as the resolved posting account
 * otherwise, and asks which account through the picker when none resolves.
 */
export const postAccountless: NonNullable<WindowKindDefinition['onPost']> = async (
  draft,
  win,
  context,
) => {
  const { state, dispatch } = context;
  if (state.accounts.length === 0) {
    return NOT_LOGGED_IN_MESSAGE;
  }
  if (hasMedia(draft)) {
    const accountKey = state.activeAccountKey;
    return await postAsAccount(context, { accountKey, windowId: win.id, draft });
  }
  const resolved = postingAccount(state, win);
  if (resolved === null) {
    dispatch({ type: 'openAccountPick', pick: { purpose: 'post', windowId: win.id, draft } });
    return null;
  }
  const accountKey = resolved.account.key;
  return await postAsAccount(context, { accountKey, windowId: win.id, draft });
};

/**
 * The post handler of the people window: its watched window's account when it
 * has one, else the account-less path ({@link postAccountless}).
 */
export const postAsWindowOrChoice: NonNullable<WindowKindDefinition['onPost']> = async (
  draft,
  win,
  context,
) =>
  win.ref.accountKey === null
    ? await postAccountless(draft, win, context)
    : await postAsWindowAccount(draft, win, context);
