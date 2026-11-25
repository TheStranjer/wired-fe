/**
 * Which feed windows a streaming frame reaches (decision 14). A feed window has
 * no account of its own, so the routing table in ./streamTargets cannot name
 * it: instead each source of its feed that belongs to the account whose
 * connection delivered the frame decides whether the frame is its kind of news
 * — `home` takes the `user` stream, `local` and `federated` their public
 * streams, `tag:<name>` a frame naming the tag (any case), `dms` a post on the
 * `direct` stream or a direct post on `user`, `notifications` every
 * notification and `mentions` the ones that are mentions. Every source that
 * takes the frame makes one item stamped with it, so the feed window gets the
 * account's copy as the account's own; a post that two accounts both hear
 * about is one line once merged. Pure: the state is a parameter, nothing is
 * dispatched.
 */

import type { AppState } from './appState';
import { type FeedItem, notificationItem, postItem } from './feedItem';
import { type FeedSource, type FeedSourceRef, type Feeds, feedById } from './feeds';
import type { AppAction } from './reducer';
import { normalizeTag, streamFamilies } from './streamTargets';
import type { Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';
import type { WindowState } from '../windows/model';

/** What a feed window can be told: a new post or a new notification. */
export type LiveEvent =
  | {
      readonly kind: 'update';
      readonly stream: readonly string[];
      readonly status: Status;
    }
  | {
      readonly kind: 'notification';
      readonly stream: readonly string[];
      readonly notification: Notification;
    };

/** The tag of a `tag:<name>` source, as windows key it. */
function tagOf(source: `tag:${string}`): string {
  return normalizeTag(source.slice('tag:'.length));
}

/** Whether a post on {@link stream} is the news of the post source {@link source}. */
function takesPost(source: FeedSource, stream: readonly string[], status: Status): boolean {
  const families = streamFamilies(stream);
  switch (source) {
    case 'home':
      return families.user;
    case 'local':
      return families.publicLocal;
    case 'federated':
      return families.public;
    case 'dms':
      return stream.includes('direct') || (families.user && status.visibility === 'direct');
    case 'mentions':
    case 'notifications':
      return false;
    default:
      return families.tags.some((tag) => normalizeTag(tag) === tagOf(source));
  }
}

/** Whether {@link notification} is the news of {@link source}. */
function takesNotification(source: FeedSource, notification: Notification): boolean {
  return source === 'notifications' || (source === 'mentions' && notification.kind === 'mention');
}

/** The item {@link event} makes for the source {@link ref}, or null when it is not that source's news. */
function itemFor(ref: FeedSourceRef, event: LiveEvent): FeedItem | null {
  if (event.kind === 'update') {
    return takesPost(ref.source, event.stream, event.status) ? postItem(event.status, ref) : null;
  }
  return takesNotification(ref.source, event.notification)
    ? notificationItem(event.notification, ref)
    : null;
}

/** The sources of the feed the window {@link win} shows; none for any other window or a feed that is gone. */
function sourcesOf(feeds: Feeds, win: WindowState): readonly FeedSourceRef[] {
  const spec = win.ref.kind === 'feed' ? feedById(feeds, win.ref.target ?? '') : undefined;
  return spec?.sources ?? [];
}

/** The items {@link event}, heard by {@link accountKey}, adds to a feed with {@link sources}. */
function itemsFor(
  sources: readonly FeedSourceRef[],
  accountKey: string,
  event: LiveEvent,
): readonly FeedItem[] {
  const items = sources
    .filter((ref) => ref.accountKey === accountKey)
    .map((ref) => itemFor(ref, event));
  return items.filter((item) => item !== null);
}

/**
 * One `feedLive` action for every open feed window with a source of
 * {@link accountKey} that {@link event} is news for; none for any other
 * window, feed or kind.
 */
export function liveFeedActions(
  state: AppState,
  accountKey: string,
  event: LiveEvent,
): readonly AppAction[] {
  return state.windows.windows.flatMap((win): AppAction[] => {
    const items = itemsFor(sourcesOf(state.settings.feeds, win), accountKey, event);
    return items.length === 0 ? [] : [{ type: 'feedLive', windowId: win.id, items }];
  });
}
