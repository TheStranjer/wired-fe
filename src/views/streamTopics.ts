/**
 * Which streams an account's connection should be joined to (AGENTS.md
 * "Windows, like IRC buffers"): always `user`, plus one per open window that
 * a public stream feeds — `public:local` for a local window, `public` for a
 * federated one, `hashtag` with the tag for each hashtag window. A feed window
 * belongs to no account, so each of its sources asks its own account's
 * connection for what it reads: `user` for `home`, `user:notification` for
 * `notifications` and `mentions`, `direct` for `dms`, and the public and
 * hashtag streams for the rest; windows share a connection and a stream, never
 * open one. Pure: the window and feed lists arrive as parameters, and {@link syncSubscriptions} applies the
 * result to a connection by joining only what is new and leaving only what is
 * gone.
 */

import {
  type StreamConnection,
  type StreamSubscription,
  subscriptionKey,
} from '../api/streamClient';
import { type FeedSource, type Feeds, feedById } from '../state/feeds';
import type { WindowKind, WindowRef, WindowState } from '../windows/model';

/** What the connection has joined so far, by {@link subscriptionKey}. */
export type Joined = {
  readonly connection: Pick<StreamConnection, 'subscribe' | 'unsubscribe'>;
  readonly subs: Map<string, StreamSubscription>;
};

/** The account's own stream, which every connection joins. */
const USER: StreamSubscription = { stream: 'user' };

/** The stream a window of one kind needs, or null when none feeds it. */
type Needs = (ref: WindowRef) => StreamSubscription | null;

/** No stream feeds this kind. */
const NOTHING: Needs = () => null;

/** What each window kind needs, every kind named so a new one has to say. */
const NEEDS: Record<WindowKind, Needs> = {
  status: NOTHING,
  home: NOTHING,
  local: () => ({ stream: 'public:local' }),
  federated: () => ({ stream: 'public' }),
  hashtag: (ref) => (ref.target === null ? null : { stream: 'hashtag', tag: ref.target }),
  dm: NOTHING,
  notifications: NOTHING,
  thread: NOTHING,
  profile: NOTHING,
  search: NOTHING,
  composer: NOTHING,
  feed: NOTHING, // a feed has no account: its sources ask, see feedNeeds
  feedEditor: NOTHING,
  people: NOTHING,
  media: NOTHING,
};

/** The sources that take no argument, each with the stream that carries it. */
const PLAIN_TOPICS: Record<Exclude<FeedSource, `tag:${string}`>, StreamSubscription> = {
  home: USER,
  mentions: { stream: 'user:notification' },
  notifications: { stream: 'user:notification' },
  dms: { stream: 'direct' },
  local: { stream: 'public:local' },
  federated: { stream: 'public' },
};

/** Whether {@link source} is a hashtag, the one source that takes an argument. */
function isTagSource(source: FeedSource): source is `tag:${string}` {
  return source.startsWith('tag:');
}

/** The stream that carries {@link source}: a hashtag's is keyed by its lower-case name, as windows are. */
export function sourceTopic(source: FeedSource): StreamSubscription {
  return isTagSource(source)
    ? { stream: 'hashtag', tag: source.slice('tag:'.length).toLowerCase() }
    : PLAIN_TOPICS[source];
}

/** The streams the feed window showing {@link target} needs from {@link accountKey}'s connection. */
function feedNeeds(
  feeds: Feeds,
  target: string | null,
  accountKey: string,
): readonly StreamSubscription[] {
  const spec = feedById(feeds, target ?? '');
  return (spec?.sources ?? [])
    .filter((ref) => ref.accountKey === accountKey)
    .map((ref) => sourceTopic(ref.source));
}

/** The streams {@link win} needs from {@link accountKey}'s connection. */
function windowNeeds(
  win: WindowState,
  accountKey: string,
  feeds: Feeds,
): readonly StreamSubscription[] {
  if (win.ref.kind === 'feed') {
    return feedNeeds(feeds, win.ref.target, accountKey);
  }
  const need = win.ref.accountKey === accountKey ? NEEDS[win.ref.kind](win.ref) : null;
  return need === null ? [] : [need];
}

/**
 * The streams {@link accountKey}'s connection should be joined to, `user`
 * first: what each window of the account needs, and what the sources of each
 * feed window that belong to the account need, so a feed shares the account's
 * one connection instead of opening its own.
 */
export function wantedStreams(
  windows: readonly WindowState[],
  accountKey: string,
  feeds: Feeds,
): readonly StreamSubscription[] {
  const wanted = new Map<string, StreamSubscription>([[subscriptionKey(USER), USER]]);
  for (const need of windows.flatMap((win) => windowNeeds(win, accountKey, feeds))) {
    wanted.set(subscriptionKey(need), need);
  }
  return [...wanted.values()];
}

/** Brings the connection's joined streams to exactly {@link wanted}. */
export function syncSubscriptions(joined: Joined, wanted: readonly StreamSubscription[]): void {
  const next = new Map(wanted.map((sub) => [subscriptionKey(sub), sub]));
  for (const [key, sub] of joined.subs) {
    if (!next.has(key)) {
      joined.connection.unsubscribe(sub);
      joined.subs.delete(key);
    }
  }
  for (const [key, sub] of next) {
    if (!joined.subs.has(key)) {
      joined.connection.subscribe(sub);
      joined.subs.set(key, sub);
    }
  }
}
