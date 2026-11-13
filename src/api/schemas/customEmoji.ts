/**
 * The CustomEmoji entity schema (decision 7): Wired's snake_case shape is the
 * internal model, and the same schema accepts Mastodon's and Pleroma's
 * renderings of it. Unknown keys (Pleroma's `tags`, Mastodon's `custom`) are
 * dropped; `static_url` falls back to `url` when a backend sends null or
 * omits it, and the picker/category defaults are applied.
 */

import * as v from 'valibot';

/** A custom emoji: its shortcode and the animated and still images behind it. */
export type CustomEmoji = {
  readonly shortcode: string;
  readonly url: string;
  readonly static_url: string;
  readonly visible_in_picker: boolean;
  readonly category: string | null;
};

/** The wire shape shared by all three backends, before normalization. */
const EmojiWireSchema = v.object({
  shortcode: v.string(),
  url: v.string(),
  static_url: v.optional(v.nullable(v.string())),
  visible_in_picker: v.optional(v.boolean(), true),
  category: v.optional(v.nullable(v.string()), null),
});

/** Parses any backend's custom emoji into the internal {@link CustomEmoji}. */
export const CustomEmojiSchema: v.GenericSchema<unknown, CustomEmoji> = v.pipe(
  EmojiWireSchema,
  v.transform((emoji) => ({ ...emoji, static_url: emoji.static_url ?? emoji.url })),
);
