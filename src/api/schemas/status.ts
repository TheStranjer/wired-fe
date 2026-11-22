/**
 * The Status entity schema (decision 7): a post as Wired reports it; the same
 * schema accepts Mastodon's and Pleroma's renderings of it and normalizes them
 * into that shape. Nine fields are required (`id`, `uri`, `created_at`,
 * `account`, `content`, `visibility` and the three counters); everything else
 * falls back to a neutral default: ids and timestamps to null, flags to false,
 * `spoiler_text` to the empty string, arrays to empty. `visibility` keeps the
 * five known audiences and folds Pleroma's `list` — and any value a future
 * backend invents — into `'private'`. `reblog` is a status of its own, parsed
 * through `v.lazy`; `quote` is extracted from any of the three wire shapes by
 * `rawQuote` and parsed the same way, so a broken or partial quote becomes
 * null instead of failing the parent status. The `pleroma` block contributes
 * `emoji_reactions` and `conversation_id`; `local_only` is read from
 * `visibility === 'local'`, never from `pleroma.local`, which means "authored
 * here", not "seen only here". Unknown keys — `card`, `filtered`, `quote_id`,
 * `application` and the rest — are dropped: WiredFE renders posts, it does not
 * re-serialize them.
 */

import * as v from 'valibot';

import type { Account } from './account';
import { AccountSchema } from './account';
import { CountSchema } from './common';
import type { CustomEmoji } from './customEmoji';
import { CustomEmojiSchema } from './customEmoji';
import type { MediaAttachment } from './mediaAttachment';
import { MediaAttachmentSchema } from './mediaAttachment';
import type { Mention } from './mention';
import { MentionSchema } from './mention';
import type { Poll } from './poll';
import { PollSchema } from './poll';
import type { Reaction } from './reaction';
import { StatusPleromaSchema } from './statusPleroma';
import { rawQuote } from './statusQuote';
import type { Tag } from './tag';
import { TagSchema } from './tag';

/** Who a post is visible to; `'local'` is Wired's instance-only audience. */
export type Visibility = 'public' | 'unlisted' | 'private' | 'direct' | 'local';

/** A post on any of the three backends, normalized to Wired's shape. */
export type Status = {
  readonly id: string;
  readonly uri: string;
  readonly url: string | null;
  readonly created_at: string;
  readonly edited_at: string | null;
  readonly account: Account;
  readonly content: string;
  readonly spoiler_text: string;
  readonly sensitive: boolean;
  readonly visibility: Visibility;
  readonly language: string | null;
  readonly in_reply_to_id: string | null;
  readonly in_reply_to_account_id: string | null;
  readonly reblog: Status | null;
  readonly quote: Status | null;
  readonly media_attachments: readonly MediaAttachment[];
  readonly mentions: readonly Mention[];
  readonly tags: readonly Tag[];
  readonly emojis: readonly CustomEmoji[];
  readonly poll: Poll | null;
  readonly replies_count: number;
  readonly reblogs_count: number;
  readonly favourites_count: number;
  readonly favourited: boolean;
  readonly reblogged: boolean;
  readonly bookmarked: boolean;
  readonly pinned: boolean;
  readonly muted: boolean;
  readonly emoji_reactions: readonly Reaction[];
  readonly local_only: boolean;
  readonly conversation_id: string | null;
};

/** The five audiences WiredFE models. */
const KnownVisibilitySchema = v.picklist(['public', 'unlisted', 'private', 'direct', 'local']);

/** Any other string a backend sends (Pleroma's `list`) is private as far as we show it. */
const OtherVisibilitySchema = v.pipe(
  v.string(),
  v.transform((): 'private' => 'private'),
);

/** The post's audience: known values pass through, the rest become `'private'`. */
const VisibilitySchema = v.union([KnownVisibilitySchema, OtherVisibilitySchema]);

/** The wire shape shared by all three backends, before normalization. The raw
 * `quote` and the `pleroma` block are kept here and extracted by the transform. */
const StatusWireSchema = v.object({
  id: v.string(),
  uri: v.string(),
  url: v.optional(v.nullable(v.string()), null),
  created_at: v.string(),
  edited_at: v.optional(v.nullable(v.string()), null),
  account: AccountSchema,
  content: v.string(),
  spoiler_text: v.optional(v.string(), ''),
  sensitive: v.optional(v.boolean(), false),
  visibility: VisibilitySchema,
  language: v.optional(v.nullable(v.string()), null),
  in_reply_to_id: v.optional(v.nullable(v.string()), null),
  in_reply_to_account_id: v.optional(v.nullable(v.string()), null),
  reblog: v.optional(v.nullable(v.lazy(() => StatusSchema)), null),
  quote: v.optional(v.unknown(), null),
  media_attachments: v.optional(v.array(MediaAttachmentSchema), []),
  mentions: v.optional(v.array(MentionSchema), []),
  tags: v.optional(v.array(TagSchema), []),
  emojis: v.optional(v.array(CustomEmojiSchema), []),
  poll: v.optional(v.nullable(PollSchema), null),
  replies_count: CountSchema,
  reblogs_count: CountSchema,
  favourites_count: CountSchema,
  favourited: v.optional(v.boolean(), false),
  reblogged: v.optional(v.boolean(), false),
  bookmarked: v.optional(v.boolean(), false),
  pinned: v.optional(v.boolean(), false),
  muted: v.optional(v.boolean(), false),
  pleroma: v.optional(v.nullable(StatusPleromaSchema), null),
});

/** Validates a raw quoted status; null, junk and partial statuses all mean "no quote". */
function parseQuote(raw: unknown): Status | null {
  const result = v.safeParse(StatusSchema, raw);
  return result.success ? result.output : null;
}

/** Parses any backend's status into the internal {@link Status}. An absent or
 * null `pleroma` block falls back to that schema's own defaults. */
export const StatusSchema: v.GenericSchema<unknown, Status> = v.pipe(
  StatusWireSchema,
  v.transform(({ quote, pleroma, ...status }) => ({
    ...status,
    quote: parseQuote(rawQuote({ quote, pleroma })),
    emoji_reactions: pleroma?.emoji_reactions ?? [],
    conversation_id: pleroma?.conversation_id ?? null,
    local_only: status.visibility === 'local',
  })),
);

/**
 * A list of statuses in which each item is parsed on its own: an item that
 * fails {@link StatusSchema} is dropped instead of failing the whole list. A
 * body that is not an array is still an error.
 */
export const StatusListSchema: v.GenericSchema<unknown, readonly Status[]> = v.pipe(
  v.array(v.unknown()),
  v.transform((items) =>
    items.flatMap((item) => {
      const result = v.safeParse(StatusSchema, item);
      return result.success ? [result.output] : [];
    }),
  ),
);
