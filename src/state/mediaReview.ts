/**
 * The check before a send that carries media (WFE-290): when any ready
 * attachment has no description, the reader is shown them all in a modal first
 * and the send waits for the answer. The modal itself lives in the app layer;
 * this module is the pure part and the seam: whether a review is due
 * ({@link needsReview}), the shape of the function that asks one
 * ({@link ReviewMedia}), and {@link reviewed}, which every send path runs
 * before it describes and posts — its answer is the media as the reader left
 * them, or null when they cancelled and nothing may go out.
 */

import type { ComposerMedia, Draft } from './draft';

/**
 * What the gate before a send that may carry media answers: the draft to send,
 * the reader's own cancel of the review (a silent stop, not an error), or why
 * the send was refused.
 */
export type Carried =
  | { readonly kind: 'carried'; readonly draft: Draft }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'refused'; readonly error: string };

/**
 * Asks the reader to review {@link items} — the ready media of the box
 * {@link windowId} holds. Resolves to the description of each line by its key,
 * or to null when they cancelled. Whatever they typed is kept on the lines
 * either way.
 */
export type ReviewMedia = (
  windowId: string,
  items: readonly ComposerMedia[],
) => Promise<ReadonlyMap<string, string> | null>;

/** Whether any ready attachment of {@link items} has no description (blank counts as none). */
export function needsReview(items: readonly ComposerMedia[]): boolean {
  return items.some((item) => item.status === 'ready' && item.description.trim() === '');
}

/** {@link items} with the description {@link descriptions} holds for each line it names. */
export function withDescriptions(
  items: readonly ComposerMedia[],
  descriptions: ReadonlyMap<string, string>,
): readonly ComposerMedia[] {
  return items.map((item) => ({
    ...item,
    description: descriptions.get(item.key) ?? item.description,
  }));
}

/**
 * The media of box {@link windowId} to send: {@link items} as they are when
 * every ready one is described, else what {@link review} made of them; null
 * when the reader cancelled.
 */
export async function reviewed(
  review: ReviewMedia,
  windowId: string,
  items: readonly ComposerMedia[],
): Promise<readonly ComposerMedia[] | null> {
  if (!needsReview(items)) {
    return items;
  }
  const typed = await review(
    windowId,
    items.filter((item) => item.status === 'ready'),
  );
  return typed === null ? null : withDescriptions(items, typed);
}
