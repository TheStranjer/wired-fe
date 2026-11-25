/**
 * The lines of a feed window's buffer (decision 14): the transition that shows
 * the merged stream of a feed. Unlike a timeline, whose pages only ever join an
 * end of the scrollback, a feed re-merges every page it has and shows the
 * visible part of it, so the transition replaces every post and notification
 * line with the stream it is given and leaves the client messages where they
 * are, at the bottom. Each line records the account its item was fetched as, so
 * commands on it act as that account. Labels, once given, stay, so a post keeps
 * its label as the stream is re-merged. The buffer also keeps the feed itself
 * (every merged item, the held-back ones too, and each source's paging), so a
 * page or a streamed item is merged into it here, and an edit or a delete
 * reaches it as it reaches the lines. Pure, like the rest of src/state.
 */

import { type Buffer, capLines, type LineData } from './buffer';
import { postKey, removeStatus, replaceStatus, shownQuote } from './bufferPosts';
import { EMPTY_FEED, type FeedCursorState, type FeedData, type FeedItem } from './feedItem';
import { mergeItems, oldestBoundary } from './feedMerge';
import type { Status } from '../api/schemas/status';
import { assignLabel } from '../windows/labels';

/** The scrollback line one feed item shows as, keyed so no two items share one. */
function lineOf(item: FeedItem): LineData {
  if (item.kind === 'post') {
    return {
      kind: 'post',
      key: postKey(item.status.id),
      status: item.status,
      accountKey: item.accountKey,
    };
  }
  return {
    kind: 'notification',
    key: `notif:${item.accountKey}:${item.notification.id}`,
    notification: item.notification,
    accountKey: item.accountKey,
  };
}

/** The status ids a feed item gives labels to: its post and the quote it shows, or its notification's post. */
function labelledIds(item: FeedItem): readonly string[] {
  if (item.kind === 'notification') {
    const { status } = item.notification;
    return status === null ? [] : [status.id];
  }
  const quoted = shownQuote(item.status);
  return quoted === null ? [item.status.id] : [item.status.id, quoted.id];
}

/**
 * Show {@link items} — newest first, as the merge engine leaves them — as the
 * buffer's post and notification lines, oldest first, replacing the ones it
 * had and keeping its client messages after them. Ids not yet labelled are
 * labelled in the order their lines come; the selection, the open content
 * warnings and the load state stay as they were. When two items would share a
 * line key (the same status id from two instances), the one nearer the top of
 * {@link items} is shown.
 */
export function setFeedLines(buffer: Buffer, items: readonly FeedItem[]): Buffer {
  const chronological = items.toReversed();
  const labels = chronological
    .flatMap(labelledIds)
    .reduce((book, id) => assignLabel(book, id)[0], buffer.labels);
  const lines = new Map(chronological.map(lineOf).map((line) => [line.key, line] as const));
  const system = buffer.lines.filter((line) => line.kind === 'system');
  return { ...buffer, labels, lines: capLines([...lines.values(), ...system]) };
}

/**
 * The buffer showing a feed that now holds {@link data}: the data is kept on
 * the buffer, and the part of it the paging boundary lets show is what the
 * scrollback holds.
 */
function showFeed(buffer: Buffer, data: FeedData): Buffer {
  const shown = setFeedLines(buffer, oldestBoundary(data.items, data.cursors).visible);
  return { ...shown, feed: data };
}

/**
 * The buffer with {@link incoming} merged into the feed it keeps (posts and
 * notifications seen on more than one account stay one line) and {@link moves}
 * written over the paging state of the sources they name.
 */
export function mergeFeed(
  buffer: Buffer,
  incoming: readonly FeedItem[],
  moves: FeedCursorState,
): Buffer {
  const before = buffer.feed ?? EMPTY_FEED;
  return showFeed(buffer, {
    items: mergeItems(before.items, incoming),
    cursors: { ...before.cursors, ...moves },
  });
}

/** Whether the feed item is a post showing status {@link id}, directly or as the post it boosts. */
function showsId(item: FeedItem, id: string): boolean {
  return item.kind === 'post' && (item.status.id === id || item.status.reblog?.id === id);
}

/** The post item with an edited status {@link status} in place of the one it showed. */
function edited(item: FeedItem, status: Status): FeedItem {
  if (item.kind !== 'post') {
    return item;
  }
  if (item.status.id === status.id) {
    return { ...item, status };
  }
  return item.status.reblog?.id === status.id
    ? { ...item, status: { ...item.status, reblog: status } }
    : item;
}

/**
 * Report an edited status to the feed the buffer keeps, as `replaceStatus` does
 * to the lines; the same buffer when no item shows it.
 */
function replaceFeedStatus(buffer: Buffer, status: Status): Buffer {
  const { feed } = buffer;
  if (feed?.items.some((item) => showsId(item, status.id)) !== true) {
    return buffer;
  }
  return { ...buffer, feed: { ...feed, items: feed.items.map((item) => edited(item, status)) } };
}

/**
 * Report a deleted status to the feed the buffer keeps, as `removeStatus` does
 * to the lines, so a later merge cannot bring it back; the same buffer when no
 * item shows it.
 */
function removeFeedStatus(buffer: Buffer, id: string): Buffer {
  const { feed } = buffer;
  if (feed?.items.some((item) => showsId(item, id)) !== true) {
    return buffer;
  }
  return { ...buffer, feed: { ...feed, items: feed.items.filter((item) => !showsId(item, id)) } };
}

/** The buffer told of an edited status: its lines and, in a feed, its items. */
export function editStatus(buffer: Buffer, status: Status): Buffer {
  return replaceFeedStatus(replaceStatus(buffer, status), status);
}

/** The buffer told of a deleted status: its lines and, in a feed, its items. */
export function deleteStatus(buffer: Buffer, id: string): Buffer {
  return removeFeedStatus(removeStatus(buffer, id), id);
}
