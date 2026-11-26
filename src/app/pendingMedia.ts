/**
 * What the command line's pending media (WFE-126, WFE-287) do to a post that
 * is about to go out: a draft naming no media of its own carries the ids of
 * the ready ones, and just before, every one the reader described in the tray
 * since it went up gets its alt text from the account that owns it
 * (src/state/describeMedia). The first refusal stops the post and comes back
 * as the line to print, so the media stay for the retry.
 */

import { type Result, err, ok } from '../lib/result';
import { COMMAND_LINE_MEDIA, composerMediaOf } from '../state/composerMedia';
import { describeMedia } from '../state/describeMedia';
import type { Draft } from '../state/draft';
import type { PostContext } from '../state/windowKind';

/**
 * {@link draft} with the ids {@link pending} when it names none of its own;
 * the same draft otherwise, so a window that already picked its media keeps
 * exactly that list. The error is why the tray's alt text could not be sent.
 */
export async function withPendingMedia(
  draft: Draft,
  pending: readonly string[],
  context: PostContext,
): Promise<Result<Draft, string>> {
  const carries = draft.mediaIds !== undefined && draft.mediaIds.length > 0;
  if (carries || pending.length === 0) {
    return ok(draft);
  }
  const { state } = context;
  const media = composerMediaOf(state, COMMAND_LINE_MEDIA);
  const refused = await describeMedia(context, state.activeAccountKey, media);
  return refused === null ? ok({ ...draft, mediaIds: pending }) : err(refused);
}
