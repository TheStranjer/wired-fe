/**
 * The Poll entity schema (decision 7): a poll attached to a status, as Wired
 * reports it; the same schema accepts Mastodon's and Pleroma's renderings.
 * `id`, `expired`, `multiple`, a non-negative integer `votes_count` and the
 * `options` array are required; each option needs a `title`, and its
 * `votes_count` — null when a backend hides per-option totals — defaults to
 * null. Everything else falls back to its logged-out shape: `expires_at` and
 * `voters_count` to null, `voted` to false, `own_votes` and `emojis` to the
 * empty array. Unknown keys (Mastodon's `cached_web_tallies`, any Pleroma
 * extras) are dropped: WiredFE renders the poll, not its provenance.
 */

import * as v from 'valibot';

import { CountSchema } from './common';
import { CustomEmojiSchema } from './customEmoji';
import type { CustomEmoji } from './customEmoji';

/** One choice in a poll: its label and how many votes it took, or null. */
export type PollOption = { readonly title: string; readonly votes_count: number | null };

/** A poll on a post: its options and tallies, and this account's vote. */
export type Poll = {
  readonly id: string;
  readonly expires_at: string | null;
  readonly expired: boolean;
  readonly multiple: boolean;
  readonly votes_count: number;
  readonly voters_count: number | null;
  readonly options: readonly PollOption[];
  readonly voted: boolean;
  readonly own_votes: readonly number[];
  readonly emojis: readonly CustomEmoji[];
};

/** A vote tally: a whole number, or null where a backend hides the totals. */
const TallySchema = v.nullable(v.pipe(v.number(), v.integer()));

/** One option: `title` required, its share of the votes defaults to null. */
const PollOptionSchema = v.object({
  title: v.string(),
  votes_count: v.optional(TallySchema, null),
});

/** Parses any backend's poll into the internal {@link Poll}. */
export const PollSchema: v.GenericSchema<unknown, Poll> = v.object({
  id: v.string(),
  expires_at: v.optional(v.nullable(v.string()), null),
  expired: v.boolean(),
  multiple: v.boolean(),
  votes_count: CountSchema,
  voters_count: v.optional(TallySchema, null),
  options: v.array(PollOptionSchema),
  voted: v.optional(v.boolean(), false),
  own_votes: v.optional(v.array(v.number()), []),
  emojis: v.optional(v.array(CustomEmojiSchema), []),
});
