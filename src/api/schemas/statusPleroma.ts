/**
 * The status `pleroma` block schema (decision 7): Pleroma and Wired attach
 * this object to statuses, Mastodon never sends one. Every field is optional
 * and falls back to a neutral default (`local` false, ids and timestamps
 * null, no reactions, not thread-muted). `conversation_id` arrives as a
 * number or a string depending on the backend and is normalised to a string.
 * `quote` is kept as the raw value: the Status schema parses it, so this one
 * does not recurse into itself. A malformed reaction entry fails the whole
 * block on purpose — backends send well-formed data, so anything else is a
 * contract break worth surfacing.
 */

import * as v from 'valibot';

import type { Reaction } from './reaction';
import { ReactionSchema } from './reaction';

/** What WiredFE reads out of a status' `pleroma` block. */
export type StatusPleroma = {
  readonly local: boolean;
  readonly conversation_id: string | null;
  readonly emoji_reactions: readonly Reaction[];
  readonly quote: unknown;
  readonly thread_muted: boolean;
  readonly expires_at: string | null;
};

/** The conversation id: Pleroma sends a number, Wired a string, null for none. */
const ConversationIdSchema = v.union([
  v.null(),
  v.string(),
  v.pipe(
    v.number(),
    v.transform((id) => String(id)),
  ),
]);

/** Parses any backend's status `pleroma` block into the internal {@link StatusPleroma}. */
export const StatusPleromaSchema: v.GenericSchema<unknown, StatusPleroma> = v.object({
  local: v.optional(v.boolean(), false),
  conversation_id: v.optional(ConversationIdSchema, null),
  emoji_reactions: v.optional(v.array(ReactionSchema), []),
  quote: v.optional(v.unknown(), null),
  thread_muted: v.optional(v.boolean(), false),
  expires_at: v.optional(v.nullable(v.string()), null),
});
