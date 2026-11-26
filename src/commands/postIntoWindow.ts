/**
 * Posting a command's trailing text into the window it just opened (WFE-279):
 * `/home sup` does what `/home` followed by typing `sup` does. The window's id
 * is known before it exists — it is derived from its ref — so the text goes
 * through the shared post path (src/state/postStatus) as the window's own
 * account, and the created status lands in that window's scrollback. This is
 * not the context's `post`, which was built for the window that was active
 * before the command ran.
 */

import { OK, fail } from './outcome';
import type { CommandContext, CommandOutcome } from './types';
import { withPendingMedia } from '../state/draft';
import { postStatus } from '../state/postStatus';

/**
 * Posts {@link text} as {@link accountKey} into the window {@link windowId},
 * carrying the pending media when there are any; those are cleared only once
 * the post is up, so a refused one keeps them for the retry. A refusal is the
 * command's failure.
 */
export async function postIntoWindow(
  context: CommandContext,
  target: { readonly accountKey: string; readonly windowId: string },
  text: string,
): Promise<CommandOutcome> {
  const draft = withPendingMedia({ text }, context.attachments.pending);
  const error = await postStatus(context, { ...target, draft });
  if (error !== null) {
    return fail(error);
  }
  context.attachments.clear();
  return OK;
}
