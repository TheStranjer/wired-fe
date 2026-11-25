/**
 * Feed ids (decision 14): a feed's id is `f<n>`, made deterministically from
 * the ids the saved feeds already have — one more than the largest `n` in use —
 * so a deleted feed's number is not reused while a later one still holds a
 * larger one, and the same list always yields the same next id.
 */

import type { Feeds } from './feeds';

/** An id this module made: `f` and a number. */
const GENERATED_ID = /^f(\d+)$/u;

/** The number inside {@link id}, or 0 for an id this module did not make. */
function numberOf(id: string): number {
  const match = GENERATED_ID.exec(id);
  return match?.[1] === undefined ? 0 : Number(match[1]);
}

/** The id for the next feed of {@link feeds}: `f1` for none, else one past the largest. */
export function nextFeedId(feeds: Feeds): string {
  return `f${String(Math.max(0, ...feeds.map((feed) => numberOf(feed.id))) + 1)}`;
}
