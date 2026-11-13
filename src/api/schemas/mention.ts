/**
 * The Mention entity schema (decision 7): the account an @-mention in a post's
 * text points at. Wired, Mastodon and Pleroma all send these four strings;
 * anything else a backend adds is dropped.
 */

import * as v from 'valibot';

/** An account mentioned in a post, as the backend resolved it. */
export type Mention = {
  readonly id: string;
  readonly username: string;
  readonly acct: string;
  readonly url: string;
};

/** Parses any backend's mention into the internal {@link Mention}. */
export const MentionSchema: v.GenericSchema<unknown, Mention> = v.object({
  id: v.string(),
  username: v.string(),
  acct: v.string(),
  url: v.string(),
});
