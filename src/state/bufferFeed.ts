/**
 * The lines of a feed window's buffer (decision 14): the transition that shows
 * the merged stream of a feed. Unlike a timeline, whose pages only ever join an
 * end of the scrollback, a feed re-merges every page it has and shows the
 * visible part of it, so the transition replaces every post and notification
 * line with the stream it is given and leaves the client messages where they
 * are, at the bottom. Each line records the account its item was fetched as, so
 * commands on it act as that account. Labels, once given, stay, so a post keeps
 * its label as the stream is re-merged. Pure, like the rest of src/state.
 */

import { type Buffer, capLines, type LineData } from './buffer';
import { postKey, shownQuote } from './bufferPosts';
import type { FeedItem } from './feedItem';
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
