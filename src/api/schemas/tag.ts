/**
 * The Tag entity schema (decision 7): a hashtag a post carries. Mastodon and
 * Pleroma add a `history` array of per-day use counts (and other keys) that
 * belongs to the trending-tags endpoint, not to the entity, so it is dropped.
 */

import * as v from 'valibot';

/** A hashtag, with the URL of its timeline. */
export type Tag = {
  readonly name: string;
  readonly url: string;
};

/** Parses any backend's hashtag into the internal {@link Tag}. */
export const TagSchema: v.GenericSchema<unknown, Tag> = v.object({
  name: v.string(),
  url: v.string(),
});
