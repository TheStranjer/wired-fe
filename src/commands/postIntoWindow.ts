/**
 * Posting a command's trailing text into the window it just opened (WFE-279):
 * `/home sup` does what `/home` followed by typing `sup` does. The window's id
 * is known before it exists — it is derived from its ref — so the text goes
 * through the window kind's own posting (a {@link TextPoster}) as the window's
 * account: src/state/postStatus puts the created status into a timeline's
 * scrollback, src/state/postAsWindowAccount only confirms it (WFE-283). This is
 * not the context's `post`, which was built for the window that was active
 * before the command ran.
 */

import { OK, fail } from './outcome';
import type { CommandContext, CommandOutcome } from './types';
import type { postStatus } from '../state/postStatus';

/** How a window kind posts a draft as its account; the shape of {@link postStatus}. */
export type TextPoster = typeof postStatus;

/**
 * Posts {@link text} through the `poster` of {@link target} as the account and
 * window it names, carrying the pending media when there are any (after the
 * reader reviewed their alt text, WFE-290: cancelling that posts nothing and says
 * nothing, WFE-294); those
 * are cleared only once the post is up, so a refused one keeps them for the
 * retry. A refusal is the command's failure.
 */
export async function postIntoWindow(
  context: CommandContext,
  target: {
    readonly poster: TextPoster;
    readonly accountKey: string;
    readonly windowId: string;
  },
  text: string,
): Promise<CommandOutcome> {
  const { poster, ...where } = target;
  const carried = await context.carryMedia({ text });
  if (carried.kind === 'cancelled') {
    return OK;
  }
  if (carried.kind === 'refused') {
    return fail(carried.error);
  }
  const error = await poster(context, { ...where, draft: carried.draft });
  if (error !== null) {
    return fail(error);
  }
  context.attachments.clear();
  return OK;
}
