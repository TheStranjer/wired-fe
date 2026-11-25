/**
 * The merge engine of a feed window (decision 14): pages from many sources
 * folded into one stream, newest first, each post or notification once. A post
 * is the same post when its uri (else url, else id plus the instance that
 * served it) matches; a mention notification and the post it is about are one
 * line, kept as the notification because it explains why the line is there;
 * any other notification is one per account and id. Every account that saw a
 * line is recorded in `seenBy`. {@link oldestBoundary} holds back what is older
 * than the least-paged source has reached, so paging never shows a gap. Pure:
 * no React, no I/O.
 */

import type { FeedItem, FeedCursorState } from './feedItem';
import type { FeedSourceRef } from './feeds';
import type { Status } from '../api/schemas/status';

/** The key of a source: its account's key and the source, `accountKey|source`. */
export function sourceKey(ref: FeedSourceRef): string {
  return `${ref.accountKey}|${ref.source}`;
}

/** The instance origin in an account key (`origin#accountId`, decision 8). */
function originOf(accountKey: string): string {
  const hash = accountKey.indexOf('#');
  return hash < 0 ? accountKey : accountKey.slice(0, hash);
}

/** What makes a status the same post everywhere: uri, else url, else id on its instance. */
function postIdentity(status: Status, accountKey: string): string {
  if (status.uri !== '') {
    return `uri|${status.uri}`;
  }
  const url = status.url ?? '';
  return url === '' ? `id|${originOf(accountKey)}|${status.id}` : `url|${url}`;
}

/** What makes two items one line: a mention shares its post's identity. */
function identity(item: FeedItem): string {
  if (item.kind === 'post') {
    return postIdentity(item.status, item.accountKey);
  }
  const { notification } = item;
  if (notification.kind === 'mention' && notification.status !== null) {
    return postIdentity(notification.status, item.accountKey);
  }
  return `notification|${item.accountKey}|${notification.id}`;
}

/** The item's moment as milliseconds; a date that does not parse counts as the oldest. */
function timeOf(item: FeedItem): number {
  const time = Date.parse(
    item.kind === 'post' ? item.status.created_at : item.notification.created_at,
  );
  return Number.isNaN(time) ? 0 : time;
}

/** The id of what the item holds, for the last tie-break. */
function idOf(item: FeedItem): string {
  return item.kind === 'post' ? item.status.id : item.notification.id;
}

/** Order two strings by code unit, so the tie-break never depends on a locale. */
function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** Newest first; equal moments by source key, then by id. */
function compareItems(a: FeedItem, b: FeedItem): number {
  const byTime = timeOf(b) - timeOf(a);
  if (byTime !== 0) {
    return byTime;
  }
  const bySource = compareText(sourceKey(a.source), sourceKey(b.source));
  return bySource === 0 ? compareText(idOf(a), idOf(b)) : bySource;
}

/** Two items that are one line, as one: a notification beats a post; `seenBy` is the union. */
function absorb(kept: FeedItem, other: FeedItem): FeedItem {
  const winner = kept.kind === 'post' && other.kind === 'notification' ? other : kept;
  return {
    ...winner,
    seenBy: [...new Set([winner.accountKey, ...kept.seenBy, ...other.seenBy])],
  };
}

/**
 * `existing` and `incoming` as one stream, newest first (equal moments by
 * source key, then id), each line once. The first copy of a line is kept,
 * except that a mention notification replaces the post it is about.
 */
export function mergeItems(
  existing: readonly FeedItem[],
  incoming: readonly FeedItem[],
): FeedItem[] {
  const lines = new Map<string, FeedItem>();
  for (const item of [...existing, ...incoming]) {
    const key = identity(item);
    const kept = lines.get(key);
    lines.set(key, kept === undefined ? item : absorb(kept, item));
  }
  return [...lines.values()].sort(compareItems);
}

/** The items shown and the items held back until another source pages further. */
export type FeedSplit = {
  readonly visible: readonly FeedItem[];
  readonly held: readonly FeedItem[];
};

/** The oldest moment loaded from each source in `open`; sources with nothing loaded are absent. */
function oldestPerSource(
  items: readonly FeedItem[],
  open: ReadonlySet<string>,
): ReadonlyMap<string, number> {
  const oldest = new Map<string, number>();
  for (const item of items) {
    const key = sourceKey(item.source);
    const time = timeOf(item);
    const known = oldest.get(key);
    if (open.has(key)) {
      oldest.set(key, known === undefined ? time : Math.min(known, time));
    }
  }
  return oldest;
}

/** The keys of the sources in `cursors` that still have an older page. */
function openSources(cursors: FeedCursorState): ReadonlySet<string> {
  return new Set(
    Object.entries(cursors)
      .filter(([, state]) => !state.exhausted)
      .map(([key]) => key),
  );
}

/**
 * The keys of the sources that set the boundary: those with an older page
 * whose oldest loaded moment is the newest of them all. Paging only these
 * moves the boundary back; none when no source with an older page has
 * anything loaded.
 */
export function blockingSources(
  items: readonly FeedItem[],
  cursors: FeedCursorState,
): readonly string[] {
  const oldest = oldestPerSource(items, openSources(cursors));
  const boundary = Math.max(...oldest.values());
  return [...oldest].filter(([, time]) => time === boundary).map(([key]) => key);
}

/**
 * Split `items` at the boundary: the newest of the oldest moments loaded from
 * each source that still has older pages. Anything older is held back, because
 * the source that stopped there may yet have posts in between. Sources that are
 * exhausted, or have nothing loaded, do not set the boundary; with no such
 * source everything is visible. Order is kept.
 */
export function oldestBoundary(items: readonly FeedItem[], cursors: FeedCursorState): FeedSplit {
  const oldest = oldestPerSource(items, openSources(cursors));
  if (oldest.size === 0) {
    return { visible: items, held: [] };
  }
  const boundary = Math.max(...oldest.values());
  return {
    visible: items.filter((item) => timeOf(item) >= boundary),
    held: items.filter((item) => timeOf(item) < boundary),
  };
}
