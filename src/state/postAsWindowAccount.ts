/**
 * Posting from a window that belongs to one account but shows no timeline
 * (WFE-283): notifications, a profile, a search and a people list. The window's
 * own account signs the post and the reader's default audience fills an unset
 * one, as in src/state/postStatus, but the created status is not added to the
 * window's buffer — it is not a timeline — and a `posted as @handle` line, the
 * one `/as` prints, confirms it instead.
 */

import { printAction } from './appState';
import type { Draft } from './draft';
import { createPost } from './postStatus';
import { accountByKey } from './selectors';
import type { PostContext, WindowKindDefinition } from './windowKind';
import { NOT_LOGGED_IN_MESSAGE, NO_POST_MESSAGE } from '../lib/refusal';

/**
 * Creates the post for {@link params.accountKey} and prints the confirmation
 * into `params.windowId`. Resolves to the error to show, or null when the post
 * is up; a null account key is refused, since there is nobody to post as.
 */
export async function postAsAccount(
  context: PostContext,
  params: {
    readonly accountKey: string | null;
    readonly windowId: string;
    readonly draft: Draft;
  },
): Promise<string | null> {
  const { accountKey, windowId, draft } = params;
  if (accountKey === null) {
    return NO_POST_MESSAGE;
  }
  const account = accountByKey(context.state, accountKey);
  if (account === null) {
    return NOT_LOGGED_IN_MESSAGE;
  }
  const created = await createPost(context, account.key, draft);
  if (!created.ok) {
    return created.error;
  }
  context.dispatch(printAction(windowId, 'info', `posted as @${account.handle}`));
  return null;
}

/**
 * The post handler of the windows that post as their own account without
 * showing a timeline: notifications, profile, search and people.
 */
export const postAsWindowAccount: NonNullable<WindowKindDefinition['onPost']> = async (
  draft,
  win,
  context,
) => await postAsAccount(context, { accountKey: win.ref.accountKey, windowId: win.id, draft });
