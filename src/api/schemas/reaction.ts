/**
 * The Reaction entity schema (decision 7): one emoji reaction on a status, as
 * Pleroma and Wired report it inside the status' `pleroma` block. `name` and a
 * non-negative integer `count` are required; `me` defaults to false and `url`
 * to null. The reactor lists some backends add (`account_ids`, `accounts`)
 * are dropped: WiredFE renders counts, not rosters.
 */

import * as v from 'valibot';

/** One emoji reaction: its emoji, how many accounts sent it, and whether this account did. */
export type Reaction = {
  readonly name: string;
  readonly count: number;
  readonly me: boolean;
  readonly url: string | null;
};

/** Parses a backend's emoji reaction entry into the internal {@link Reaction}. */
export const ReactionSchema: v.GenericSchema<unknown, Reaction> = v.object({
  name: v.string(),
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  me: v.optional(v.boolean(), false),
  url: v.optional(v.nullable(v.string()), null),
});
