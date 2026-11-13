/**
 * The Conversation entity schema (decision 7): a direct-message thread as
 * Wired reports it, with its participants and most recent post. `id` and
 * `accounts` are required; `unread` defaults to false and `last_status` to
 * null, because a backend may omit either. Pleroma attaches a `pleroma`
 * block of its own (`recipients`) — those accounts are already in
 * `accounts`, so the whole block is dropped along with any other unknown
 * key. Accounts and statuses are parsed by their own schemas, so each
 * backend's quirks normalize exactly as they do in a timeline.
 */

import * as v from 'valibot';

import type { Account } from './account';
import { AccountSchema } from './account';
import type { Status } from './status';
import { StatusSchema } from './status';

/** A direct-message thread: who is in it, and what was last said. */
export type Conversation = {
  readonly id: string;
  readonly accounts: readonly Account[];
  readonly unread: boolean;
  readonly last_status: Status | null;
};

/** Parses any backend's conversation into the internal {@link Conversation}. */
export const ConversationSchema: v.GenericSchema<unknown, Conversation> = v.object({
  id: v.string(),
  accounts: v.array(AccountSchema),
  unread: v.optional(v.boolean(), false),
  last_status: v.optional(v.nullable(StatusSchema), null),
});
