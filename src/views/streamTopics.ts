/**
 * Which streams an account's connection should be joined to (AGENTS.md
 * "Windows, like IRC buffers"): always `user`, plus one per open window that
 * a public stream feeds — `public:local` for a local window, `public` for a
 * federated one, `hashtag` with the tag for each hashtag window. Pure: the window
 * list arrives as a parameter, and {@link syncSubscriptions} applies the
 * result to a connection by joining only what is new and leaving only what is
 * gone.
 */

import {
  type StreamConnection,
  type StreamSubscription,
  subscriptionKey,
} from '../api/streamClient';
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
  feed: NOTHING,
};

/** The streams {@link accountKey}'s connection should be joined to, `user` first. */
export function wantedStreams(
  windows: readonly WindowState[],
  accountKey: string,
): readonly StreamSubscription[] {
  const wanted = new Map<string, StreamSubscription>([[subscriptionKey(USER), USER]]);
  for (const win of windows) {
    const need = win.ref.accountKey === accountKey ? NEEDS[win.ref.kind](win.ref) : null;
    if (need !== null) {
      wanted.set(subscriptionKey(need), need);
    }
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
