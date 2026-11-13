/**
 * The MediaAttachment entity schema (decision 7): one file attached to a post.
 * Wired's snake_case shape is the internal model, and the same schema accepts
 * Mastodon's and Pleroma's renderings of it. Unknown keys (Mastodon's `meta`,
 * Pleroma's `pleroma` block, the `text_url` Akkoma still sends) are dropped:
 * WiredFE renders the attachment, it does not re-serialize it. A `type` it has
 * no renderer for — Pleroma's `document`, any value a future backend invents —
 * normalizes to `'unknown'`, and an empty-string `description` becomes null:
 * empty alt text is no alt text.
 */

import * as v from 'valibot';

/** The media kinds WiredFE distinguishes; `'unknown'` covers every other one. */
export type MediaType = 'image' | 'gifv' | 'video' | 'audio' | 'unknown';

/** One attachment on a post: where its files live and what is in them. */
export type MediaAttachment = {
  readonly id: string;
  readonly type: MediaType;
  readonly url: string;
  readonly preview_url: string | null;
  readonly remote_url: string | null;
  readonly description: string | null;
  readonly blurhash: string | null;
};

/** The kinds WiredFE has a renderer for. */
const KnownMediaTypeSchema = v.picklist(['image', 'gifv', 'video', 'audio']);

/** Any other string a backend sends names a kind WiredFE cannot render. */
const OtherMediaTypeSchema = v.pipe(
  v.string(),
  v.transform((): 'unknown' => 'unknown'),
);

/** The attachment's kind: the known ones pass through, the rest are unknown. */
const MediaTypeSchema = v.union([KnownMediaTypeSchema, OtherMediaTypeSchema]);

/** Alt text: absent, null and the empty string all mean "not described". */
const DescriptionSchema = v.pipe(
  v.nullable(v.string()),
  v.transform((text) => (text === null || text === '' ? null : text)),
);

/** Parses any backend's media attachment into the internal {@link MediaAttachment}. */
export const MediaAttachmentSchema: v.GenericSchema<unknown, MediaAttachment> = v.object({
  id: v.string(),
  type: MediaTypeSchema,
  url: v.string(),
  preview_url: v.optional(v.nullable(v.string()), null),
  remote_url: v.optional(v.nullable(v.string()), null),
  description: v.optional(DescriptionSchema, null),
  blurhash: v.optional(v.nullable(v.string()), null),
});
