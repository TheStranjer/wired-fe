/**
 * The saved-feed model (decision 14): a `FeedSpec` is an id, a name and the
 * sources — each one a kind of stream read as one signed-in account — that a
 * feed window merges. Pure data: the valibot schema that reads the list back
 * from storage (names 1-32 characters and unique ignoring case, tag names
 * non-empty without `#` or spaces), the helpers that add, rename, remove and
 * look feeds up, and the one that drops a signed-out account's sources. The
 * command grammar that reads `@me@host:home` into references is in
 * src/state/feedSource.
 */

import * as v from 'valibot';

import { type Result, err, ok } from '../lib/result';

/** One kind of stream a feed can read: a timeline, an inbox or a hashtag. */
export type FeedSource =
  'home' | 'mentions' | 'dms' | 'notifications' | 'local' | 'federated' | `tag:${string}`;

/** One source read as one account: the account's key and what to read. */
export type FeedSourceRef = { readonly accountKey: string; readonly source: FeedSource };

/** A saved feed: a stable id, the name the user gave it and what it merges. */
export type FeedSpec = {
  readonly id: string;
  readonly name: string;
  readonly sources: readonly FeedSourceRef[];
};

/** The feeds a reader has saved, in the order they made them. */
export type Feeds = readonly FeedSpec[];

/** The longest a feed name may be. */
export const MAX_FEED_NAME = 32;

/** The sources that take no argument. */
const PLAIN_SOURCES = ['home', 'mentions', 'dms', 'notifications', 'local', 'federated'] as const;

/** A hashtag name: something, with no `#` and no whitespace. */
const TAG_NAME = /^[^#\s]+$/u;

/** Whether {@link text} is a source: a plain one or `tag:<name>`. */
export function isFeedSource(text: string): text is FeedSource {
  if (text.startsWith('tag:')) {
    return TAG_NAME.test(text.slice('tag:'.length));
  }
  return (PLAIN_SOURCES as readonly string[]).includes(text);
}

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

/** Whether two references name the same source of the same account. */
function sameRef(a: FeedSourceRef, b: FeedSourceRef): boolean {
  return a.accountKey === b.accountKey && a.source === b.source;
}

/** {@link refs} with later repeats of an identical reference dropped. */
function deduped(refs: readonly FeedSourceRef[]): readonly FeedSourceRef[] {
  return refs.filter((ref, index) => refs.findIndex((other) => sameRef(other, ref)) === index);
}

/** The feed with this name, ignoring case, or undefined. */
export function feedByName(feeds: Feeds, name: string): FeedSpec | undefined {
  const wanted = name.trim().toLowerCase();
  return feeds.find((feed) => feed.name.toLowerCase() === wanted);
}

/** The feed with this id, or undefined. */
export function feedById(feeds: Feeds, id: string): FeedSpec | undefined {
  return feeds.find((feed) => feed.id === id);
}

/** The trimmed name, or why it cannot name the feed {@link id} among {@link feeds}. */
function checkedName(feeds: Feeds, name: string, id: string): Result<string, string> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_FEED_NAME) {
    return err(`A feed name is 1-${String(MAX_FEED_NAME)} characters`);
  }
  const clash = feedByName(feeds, trimmed);
  if (clash !== undefined && clash.id !== id) {
    return err(`A feed named "${clash.name}" already exists`);
  }
  return ok(trimmed);
}

/** {@link feeds} with the feed {@link id} replaced by what {@link change} makes of it. */
function mapFeed(feeds: Feeds, id: string, change: (feed: FeedSpec) => FeedSpec): Feeds {
  return feeds.map((feed) => (feed.id === id ? change(feed) : feed));
}

/** {@link feeds} plus {@link spec} (name trimmed, sources deduped); an error for a bad or taken name or id. */
export function addFeed(feeds: Feeds, spec: FeedSpec): Result<Feeds, string> {
  if (feedById(feeds, spec.id) !== undefined) {
    return err(`A feed with id ${spec.id} already exists`);
  }
  const name = checkedName(feeds, spec.name, spec.id);
  if (!name.ok) {
    return name;
  }
  return ok([...feeds, { id: spec.id, name: name.value, sources: deduped(spec.sources) }]);
}

/** {@link feeds} without the feed {@link id}; unchanged when there is none. */
export function removeFeed(feeds: Feeds, id: string): Feeds {
  return feeds.filter((feed) => feed.id !== id);
}

/** {@link feeds} with the feed {@link id} renamed; an error for an unknown feed or a bad or taken name. */
export function renameFeed(feeds: Feeds, id: string, name: string): Result<Feeds, string> {
  if (feedById(feeds, id) === undefined) {
    return err(`No feed with id ${id}`);
  }
  const checked = checkedName(feeds, name, id);
  if (!checked.ok) {
    return checked;
  }
  return ok(mapFeed(feeds, id, (feed) => ({ ...feed, name: checked.value })));
}

/** {@link feeds} with {@link refs} added to the feed {@link id}, identical sources kept once. */
export function addSource(feeds: Feeds, id: string, refs: readonly FeedSourceRef[]): Feeds {
  return mapFeed(feeds, id, (feed) => ({ ...feed, sources: deduped([...feed.sources, ...refs]) }));
}

/** {@link feeds} with {@link ref} taken out of the feed {@link id}. */
export function removeSource(feeds: Feeds, id: string, ref: FeedSourceRef): Feeds {
  return mapFeed(feeds, id, (feed) => ({
    ...feed,
    sources: feed.sources.filter((other) => !sameRef(other, ref)),
  }));
}

/** {@link feeds} without the sources of the account {@link accountKey}; feeds left empty stay. */
export function dropAccount(feeds: Feeds, accountKey: string): Feeds {
  return feeds.map((feed) => ({
    ...feed,
    sources: feed.sources.filter((ref) => ref.accountKey !== accountKey),
  }));
}
