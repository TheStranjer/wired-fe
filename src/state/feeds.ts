/**
 * The saved-feed model (decision 14): a `FeedSpec` is an id, a name and the
 * sources — each one a kind of stream read as one signed-in account — that a
 * feed window merges. Pure data: the schema that reads the list back from
 * storage is in ./feedSchema; here are the helpers that add, rename, remove
 * and look feeds up, set the account a feed posts as, and drop a signed-out
 * account's sources and posting default. The command grammar that reads
 * `@me@host:home` into references is in src/state/feedSource.
 */

import { t } from '../i18n/translate';
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
  /**
   * Set on the feed the client made itself (the `stream` of a first sign-in)
   * and cleared by any edit of the reader's: only an automatic feed grows by
   * itself when another account signs in.
   */
  readonly auto?: boolean | undefined;
  /** The key of the account plain text in this feed's window posts as (WFE-281); absent when unset. */
  readonly postAs?: string | undefined;
};

/** The feeds a reader has saved, in the order they made them. */
export type Feeds = readonly FeedSpec[];

/** The longest a feed name may be. */
export const MAX_FEED_NAME = 32;

/** The sources that take no argument. */
export const PLAIN_SOURCES = [
  'home',
  'mentions',
  'dms',
  'notifications',
  'local',
  'federated',
] as const;

/** A hashtag name: something, with no `#` and no whitespace. */
const TAG_NAME = /^[^#\s]+$/u;

/** Whether {@link text} is a source: a plain one or `tag:<name>`. */
export function isFeedSource(text: string): text is FeedSource {
  if (text.startsWith('tag:')) {
    return TAG_NAME.test(text.slice('tag:'.length));
  }
  return (PLAIN_SOURCES as readonly string[]).includes(text);
}

/** Whether two references name the same source of the same account. */
export function sameRef(a: FeedSourceRef, b: FeedSourceRef): boolean {
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

/** Why {@link name} is too short or too long to name a feed, or null when its length is fine. */
export function nameProblem(name: string): string | null {
  const length = name.trim().length;
  return length < 1 || length > MAX_FEED_NAME
    ? t('state.feed_name_length', { max: String(MAX_FEED_NAME) })
    : null;
}

/** The trimmed name, or why it cannot name the feed {@link id} among {@link feeds}. */
function checkedName(feeds: Feeds, name: string, id: string): Result<string, string> {
  const problem = nameProblem(name);
  if (problem !== null) {
    return err(problem);
  }
  const trimmed = name.trim();
  const clash = feedByName(feeds, trimmed);
  if (clash !== undefined && clash.id !== id) {
    return err(t('state.feed_name_taken', { name: clash.name }));
  }
  return ok(trimmed);
}

/** {@link feed} as a reader's edit leaves it: with {@link change} laid over it, and no longer automatic. */
function edited(feed: FeedSpec, change: Partial<Pick<FeedSpec, 'name' | 'sources'>>): FeedSpec {
  const kept = feed.postAs === undefined ? {} : { postAs: feed.postAs };
  return { id: feed.id, name: feed.name, sources: feed.sources, ...kept, ...change };
}

/** {@link feeds} with the feed {@link id} replaced by what {@link change} makes of it. */
function mapFeed(feeds: Feeds, id: string, change: (feed: FeedSpec) => FeedSpec): Feeds {
  return feeds.map((feed) => (feed.id === id ? change(feed) : feed));
}

/** {@link feeds} plus {@link spec} (name trimmed, sources deduped); an error for a bad or taken name or id. */
export function addFeed(feeds: Feeds, spec: FeedSpec): Result<Feeds, string> {
  if (feedById(feeds, spec.id) !== undefined) {
    return err(t('state.feed_id_taken', { id: spec.id }));
  }
  const name = checkedName(feeds, spec.name, spec.id);
  if (!name.ok) {
    return name;
  }
  return ok([...feeds, { ...spec, name: name.value, sources: deduped(spec.sources) }]);
}

/** {@link feeds} without the feed {@link id}; unchanged when there is none. */
export function removeFeed(feeds: Feeds, id: string): Feeds {
  return feeds.filter((feed) => feed.id !== id);
}

/** {@link feeds} with the feed {@link id} renamed; an error for an unknown feed or a bad or taken name. */
export function renameFeed(feeds: Feeds, id: string, name: string): Result<Feeds, string> {
  if (feedById(feeds, id) === undefined) {
    return err(t('state.no_feed_with_id', { id }));
  }
  const checked = checkedName(feeds, name, id);
  if (!checked.ok) {
    return checked;
  }
  return ok(mapFeed(feeds, id, (feed) => edited(feed, { name: checked.value })));
}

/** {@link feeds} with {@link refs} added to the feed {@link id}, identical sources kept once. */
export function addSource(feeds: Feeds, id: string, refs: readonly FeedSourceRef[]): Feeds {
  return mapFeed(feeds, id, (feed) =>
    edited(feed, { sources: deduped([...feed.sources, ...refs]) }),
  );
}

/** Like {@link addSource}, but the client's own doing: the feed stays automatic. */
export function addAutoSources(feeds: Feeds, id: string, refs: readonly FeedSourceRef[]): Feeds {
  return mapFeed(feeds, id, (feed) => ({ ...feed, sources: deduped([...feed.sources, ...refs]) }));
}

/** {@link feeds} with {@link ref} taken out of the feed {@link id}. */
export function removeSource(feeds: Feeds, id: string, ref: FeedSourceRef): Feeds {
  return mapFeed(feeds, id, (feed) =>
    edited(feed, { sources: feed.sources.filter((other) => !sameRef(other, ref)) }),
  );
}

/** {@link feeds} with the feed {@link id} posting as the account {@link key}, or as none for undefined. */
export function setFeedPostAs(feeds: Feeds, id: string, key: string | undefined): Feeds {
  return mapFeed(feeds, id, (feed) => ({ ...feed, postAs: key }));
}

/** {@link feeds} without the sources of the account {@link accountKey}, nor it as a posting default; feeds left empty stay. */
export function dropAccount(feeds: Feeds, accountKey: string): Feeds {
  return feeds.map((feed) => ({
    ...feed,
    sources: feed.sources.filter((ref) => ref.accountKey !== accountKey),
    ...(feed.postAs === accountKey ? { postAs: undefined } : {}),
  }));
}
