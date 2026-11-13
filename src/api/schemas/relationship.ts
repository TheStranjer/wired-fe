/**
 * The Relationship entity schema (decision 7): how the authenticated account
 * stands to another account. Only `id` is required: Mastodon omits booleans it
 * considers implicit and Pleroma sends extras of its own (`subscribing`,
 * `languages`, …), all of which are dropped. Every flag defaults to false
 * except `showing_reblogs`, which is on unless a backend says otherwise, and
 * the follow note, which defaults to the empty string.
 */

import * as v from 'valibot';

/** The current account's state towards the account this describes. */
export type Relationship = {
  readonly id: string;
  readonly following: boolean;
  readonly followed_by: boolean;
  readonly requested: boolean;
  readonly blocking: boolean;
  readonly blocked_by: boolean;
  readonly muting: boolean;
  readonly muting_notifications: boolean;
  readonly domain_blocking: boolean;
  readonly showing_reblogs: boolean;
  readonly notifying: boolean;
  readonly endorsed: boolean;
  readonly note: string;
};

/** Parses any backend's relationship into the internal {@link Relationship}. */
export const RelationshipSchema: v.GenericSchema<unknown, Relationship> = v.object({
  id: v.string(),
  following: v.optional(v.boolean(), false),
  followed_by: v.optional(v.boolean(), false),
  requested: v.optional(v.boolean(), false),
  blocking: v.optional(v.boolean(), false),
  blocked_by: v.optional(v.boolean(), false),
  muting: v.optional(v.boolean(), false),
  muting_notifications: v.optional(v.boolean(), false),
  domain_blocking: v.optional(v.boolean(), false),
  showing_reblogs: v.optional(v.boolean(), true),
  notifying: v.optional(v.boolean(), false),
  endorsed: v.optional(v.boolean(), false),
  note: v.optional(v.string(), ''),
});
