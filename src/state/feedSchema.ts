/**
 * The valibot schema that reads the saved-feed list back from storage (the
 * model is in ./feeds): names 1-32 characters and unique ignoring case, ids
 * unique, tag names non-empty without `#` or spaces. The `auto` and `postAs`
 * fields are optional, so a list stored before they existed still parses.
 */

import * as v from 'valibot';

import { type FeedSource, type Feeds, MAX_FEED_NAME, isFeedSource } from './feeds';

/** The source field: a plain source or a tag with a valid name. */
const FeedSourceSchema = v.custom<FeedSource>(
  (input) => typeof input === 'string' && isFeedSource(input),
  'Not a feed source',
);

/** One source reference as storage keeps it. */
const FeedSourceRefSchema = v.object({ accountKey: v.string(), source: FeedSourceSchema });

/** One feed as storage keeps it, before the cross-feed checks. */
const OneFeedSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_FEED_NAME)),
  sources: v.array(FeedSourceRefSchema),
  auto: v.optional(v.boolean()),
  postAs: v.optional(v.string()),
});

/** The stored feed list: every feed valid, names unique ignoring case, ids unique. */
export const FeedsSchema: v.GenericSchema<unknown, Feeds> = v.pipe(
  v.array(OneFeedSchema),
  v.check(
    (feeds) => new Set(feeds.map((f) => f.name.toLowerCase())).size === feeds.length,
    'Duplicate name',
  ),
  v.check((feeds) => new Set(feeds.map((f) => f.id)).size === feeds.length, 'Duplicate id'),
);
