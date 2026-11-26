/**
 * What the command line's pending media (WFE-126, WFE-287) do to a post that
 * is about to go out: a draft naming no media of its own carries the ids of
 * the ready ones. Before that, any ready one without a description is shown to
 * the reader in the review modal (WFE-290, src/state/mediaReview) — cancelling
 * it refuses the post, keeping the media — and just before the post, every one
 * the reader described in the tray or the modal since it went up gets its alt
 * text from the account that owns it (src/state/describeMedia). The first
 * refusal stops the post and comes back as the line to print, so the media
 * stay for the retry.
 */

import { type Result, err, ok } from '../lib/result';
import { COMMAND_LINE_MEDIA, composerMediaOf } from '../state/composerMedia';
import { describeMedia } from '../state/describeMedia';
import { type Draft, withPendingMedia as carryIds } from '../state/draft';
import { SEND_CANCELLED, type ReviewMedia, reviewed } from '../state/mediaReview';
import type { PostContext } from '../state/windowKind';

/** What a post of the command line runs in: the post context, and how the reader reviews alt text. */
export type MediaPostContext = PostContext & { readonly review: ReviewMedia };

/**
 * {@link draft} with the ids {@link pending} when it names none of its own;
 * the same draft otherwise, so a window that already picked its media keeps
 * exactly that list. The error is why the post must not go out: the reader
 * cancelled the review, or the tray's alt text could not be sent.
 */
export async function withPendingMedia(
  draft: Draft,
  pending: readonly string[],
  context: MediaPostContext,
): Promise<Result<Draft, string>> {
  const carried = carryIds(draft, pending);
  if (carried === draft) {
    return ok(draft);
  }
  const { state } = context;
  const media = await reviewed(
    context.review,
    COMMAND_LINE_MEDIA,
    composerMediaOf(state, COMMAND_LINE_MEDIA),
  );
  if (media === null) {
    return err(SEND_CANCELLED);
  }
  const refused = await describeMedia(context, state.activeAccountKey, media);
  return refused === null ? ok(carried) : err(refused);
}
