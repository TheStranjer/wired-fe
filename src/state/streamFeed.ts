/**
 * The default `stream` feed (WFE-243, decision 14): on a first sign-in, a feed
 * named `stream` that mixes every signed-in account's home, mentions, DMs and
 * notifications, flagged automatic. While the reader leaves it alone it grows
 * with every account that signs in later; the first `/feed` edit clears the
 * flag (./feeds), and from then on a newcomer only earns a hint saying how to
 * add it by hand. Pure: the reducer and startup both ask these functions what
 * to do and do it themselves.
 */

import { nextFeedId } from './feedId';
import {
  type FeedSource,
  type FeedSourceRef,
  type FeedSpec,
  type Feeds,
  addAutoSources,
  feedByName,
} from './feeds';
import type { Settings } from './settings';
import type { StoredAccount } from '../accounts/accountStore';
import { t } from '../i18n/translate';

/** The name of the default feed. */
const STREAM_FEED_NAME = 'stream';

/** What the stream reads of every account, in the order `*:<source>` would list it. */
const STREAM_SOURCES: readonly FeedSource[] = ['home', 'mentions', 'dms', 'notifications'];

/** Every stream source of every one of {@link accounts}, one source at a time. */
function streamRefs(accounts: readonly StoredAccount[]): readonly FeedSourceRef[] {
  return STREAM_SOURCES.flatMap((source) =>
    accounts.map((account) => ({ accountKey: account.key, source })),
  );
}

/**
 * The feed to make for {@link accounts} given the feeds {@link existingFeeds}
 * already saved: `stream`, automatic, reading the four sources of every
 * account; null when nobody is signed in or any feed exists.
 */
export function defaultFeedFor(
  accounts: readonly StoredAccount[],
  existingFeeds: Feeds,
): FeedSpec | null {
  if (accounts.length === 0 || existingFeeds.length > 0) {
    return null;
  }
  return {
    id: nextFeedId(existingFeeds),
    name: STREAM_FEED_NAME,
    sources: streamRefs(accounts),
    auto: true,
  };
}

/** The default feed to make now: none once one has been made (even if it was deleted since). */
export function streamSeed(
  settings: Settings,
  accounts: readonly StoredAccount[],
): FeedSpec | null {
  return settings.streamMade ? null : defaultFeedFor(accounts, settings.feeds);
}

/** What a newly signed-in account does to the feeds. */
type StreamJoin = {
  /** The feeds afterwards. */
  readonly feeds: Feeds;
  /** Whether the account is now part of an automatic stream, so it needs no windows of its own. */
  readonly joined: boolean;
  /** What to tell the reader when an edited stream could not take the account, else null. */
  readonly hint: string | null;
};

/**
 * {@link feeds} after {@link account} signs in: an automatic `stream` takes
 * its four sources, an edited one is left alone and a hint says how to add
 * them, and with no `stream` nothing happens.
 */
export function joinStream(feeds: Feeds, account: StoredAccount): StreamJoin {
  const stream = feedByName(feeds, STREAM_FEED_NAME);
  if (stream === undefined) {
    return { feeds, joined: false, hint: null };
  }
  if (stream.auto === true) {
    const added = addAutoSources(feeds, stream.id, streamRefs([account]));
    return { feeds: added, joined: true, hint: null };
  }
  const sources = STREAM_SOURCES.map((source) => `@${account.handle}:${source}`).join(' ');
  const hint = t('state.stream_edited_hint', {
    name: stream.name,
    handle: account.handle,
    sources,
  });
  return { feeds, joined: false, hint };
}

/** What a desk-less startup does about the stream: settings to change and the feed to show, if any. */
type StartupStream = {
  readonly patch: Partial<Settings> | null;
  readonly open: FeedSpec | null;
};

/**
 * The stream part of a startup with no saved desk: the first run makes the
 * feed and shows it; a session whose stream is still automatic shows it again;
 * anything else shows no stream.
 */
export function startupStream(
  settings: Settings,
  accounts: readonly StoredAccount[],
): StartupStream {
  const seed = streamSeed(settings, accounts);
  if (seed !== null) {
    return { patch: { feeds: [seed], streamMade: true }, open: seed };
  }
  const stream = feedByName(settings.feeds, STREAM_FEED_NAME);
  return { patch: null, open: stream?.auto === true ? stream : null };
}
