/**
 * What a feed window merges (decision 14): one item per post or notification,
 * tagged with the source reference that fetched it and the account it was
 * fetched as, plus the paging state of each source. Plain data; the merging is
 * in src/state/feedMerge.
 */

import type { FeedSourceRef } from './feeds';
import type { PageCursor } from '../api/pagination';
import type { Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';

/** What every feed item carries, whatever it holds. */
type FeedItemBase = {
  /** The source reference that produced the item. */
  readonly source: FeedSourceRef;
  /** The key of the account that fetched it; commands on the item act as this account. */
  readonly accountKey: string;
  /** Every account that saw the item, in the order they did; the first is the acting account. */
  readonly seenBy: readonly string[];
};

/** A post in a feed. */
export type FeedPost = FeedItemBase & { readonly kind: 'post'; readonly status: Status };

/** A notification in a feed. */
export type FeedNotification = FeedItemBase & {
  readonly kind: 'notification';
  readonly notification: Notification;
};

/** One line of a feed: a post or a notification. */
export type FeedItem = FeedPost | FeedNotification;

/** Where one source has paged to. */
type SourceCursor = {
  /** What to ask for to get the page older than the oldest loaded, or null before any page. */
  readonly cursor: PageCursor | null;
  /** Whether the source has no older page left. */
  readonly exhausted: boolean;
};

/** The paging state of every source of a feed, keyed by {@link sourceKey}. */
export type FeedCursorState = Readonly<Record<string, SourceCursor>>;

/** A post item as fetched by `source`: seen so far by that account alone. */
export function postItem(status: Status, source: FeedSourceRef): FeedPost {
  return {
    kind: 'post',
    status,
    source,
    accountKey: source.accountKey,
    seenBy: [source.accountKey],
  };
}

/** A notification item as fetched by `source`: seen so far by that account alone. */
export function notificationItem(
  notification: Notification,
  source: FeedSourceRef,
): FeedNotification {
  return {
    kind: 'notification',
    notification,
    source,
    accountKey: source.accountKey,
    seenBy: [source.accountKey],
  };
}
