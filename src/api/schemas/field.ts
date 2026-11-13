/**
 * The Field entity schema (decision 7): one name/value row of a profile's
 * metadata. Wired, Mastodon and Pleroma all send `name` and `value` (hostile
 * HTML, rendered only through the sanitizing component); `verified_at` is
 * null on backends that do not verify profile links, absent or null.
 */

import * as v from 'valibot';

/** One metadata row of an account's profile. */
export type Field = {
  readonly name: string;
  readonly value: string;
  readonly verified_at: string | null;
};

/** Parses any backend's profile field into the internal {@link Field}. */
export const FieldSchema: v.GenericSchema<unknown, Field> = v.object({
  name: v.string(),
  value: v.string(),
  verified_at: v.optional(v.nullable(v.string()), null),
});
