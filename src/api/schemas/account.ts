/**
 * The Account entity schema (decision 7): a user as Wired reports it; the same
 * schema accepts Mastodon's and Pleroma's renderings of it. The twelve fields
 * every backend sends are required, the rest fall back to a neutral default:
 * `fqn`, `uri`, `discoverable` and `last_status_at` to null, `locked`, `bot` and
 * `group` to false, `emojis`, `fields` and `moved` and the `pleroma` block to
 * their empty forms. `avatar_static` and `header_static` fall back to the
 * animated images when a backend omits them or sends null for them.
 * `moved` is an account of its own, so it is parsed through `v.lazy`.
 *
 * Unknown top-level keys are dropped — Mastodon's `source`, `role`, `roles` and
 * `noindex`, a `relationship` a backend attaches — and so is everything inside
 * `pleroma` beyond the five keys WiredFE reads, such as `hide_followers` and
 * `tags`.
 */

import * as v from 'valibot';

import { CustomEmojiSchema } from './customEmoji';
import type { CustomEmoji } from './customEmoji';
import { FieldSchema } from './field';
import type { Field } from './field';

/** What WiredFE reads out of an account's `pleroma` block. */
export type AccountPleroma = {
  readonly is_admin: boolean;
  readonly is_moderator: boolean;
  readonly accepts_chat_messages: boolean | null;
  readonly favicon: string | null;
  readonly background_image: string | null;
};

/** An account on any of the three backends, normalized to Wired's shape. */
export type Account = {
  readonly id: string;
  readonly username: string;
  readonly acct: string;
  readonly fqn: string | null;
  readonly display_name: string;
  readonly locked: boolean;
  readonly bot: boolean;
  readonly group: boolean;
  readonly discoverable: boolean | null;
  readonly created_at: string;
  readonly note: string;
  readonly url: string;
  readonly uri: string | null;
  readonly avatar: string;
  readonly avatar_static: string;
  readonly header: string;
  readonly header_static: string;
  readonly followers_count: number;
  readonly following_count: number;
  readonly statuses_count: number;
  readonly last_status_at: string | null;
  readonly emojis: readonly CustomEmoji[];
  readonly fields: readonly Field[];
  readonly moved: Account | null;
  readonly pleroma: AccountPleroma | null;
};

/** A profile counter: a whole number that is never negative. */
const CountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

/** The account `pleroma` block: every key optional, the rest of it dropped. */
const PleromaSchema: v.GenericSchema<unknown, AccountPleroma> = v.object({
  is_admin: v.optional(v.boolean(), false),
  is_moderator: v.optional(v.boolean(), false),
  accepts_chat_messages: v.optional(v.nullable(v.boolean()), null),
  favicon: v.optional(v.nullable(v.string()), null),
  background_image: v.optional(v.nullable(v.string()), null),
});

/** An account's own fields before the still-image defaults are filled in. */
const AccountWireSchema = v.object({
  id: v.string(),
  username: v.string(),
  acct: v.string(),
  fqn: v.optional(v.nullable(v.string()), null),
  display_name: v.string(),
  locked: v.optional(v.boolean(), false),
  bot: v.optional(v.boolean(), false),
  group: v.optional(v.boolean(), false),
  discoverable: v.optional(v.nullable(v.boolean()), null),
  created_at: v.string(),
  note: v.string(),
  url: v.string(),
  uri: v.optional(v.nullable(v.string()), null),
  avatar: v.string(),
  avatar_static: v.optional(v.nullable(v.string())),
  header: v.string(),
  header_static: v.optional(v.nullable(v.string())),
  followers_count: CountSchema,
  following_count: CountSchema,
  statuses_count: CountSchema,
  last_status_at: v.optional(v.nullable(v.string()), null),
  emojis: v.optional(v.array(CustomEmojiSchema), []),
  fields: v.optional(v.array(FieldSchema), []),
  moved: v.nullish(
    v.lazy(() => AccountSchema),
    null,
  ),
  pleroma: v.optional(v.nullable(PleromaSchema), null),
});

/** Parses any backend's account into the internal {@link Account}. */
export const AccountSchema: v.GenericSchema<unknown, Account> = v.pipe(
  AccountWireSchema,
  v.transform(({ avatar, avatar_static, header, header_static, ...account }) => ({
    ...account,
    avatar,
    avatar_static: avatar_static ?? avatar,
    header,
    header_static: header_static ?? header,
  })),
);
