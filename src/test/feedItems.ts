/**
 * Feed items for the feed merge tests: three sources on three instances and
 * builders for the posts they would fetch, stamped minutes past noon.
 */

import { status } from './fixtures';
import { type FeedItem, postItem } from '../state/feedItem';
import type { FeedSourceRef } from '../state/feeds';

/** Account one's home timeline. */
export const A_HOME: FeedSourceRef = { accountKey: 'https://a.example#1', source: 'home' };

/** Account one's mentions. */
export const A_MENTIONS: FeedSourceRef = { accountKey: 'https://a.example#1', source: 'mentions' };

/** Account two's home timeline, on another instance. */
export const B_HOME: FeedSourceRef = { accountKey: 'https://b.example#2', source: 'home' };

/** Account three's local timeline, on a third instance. */
export const C_LOCAL: FeedSourceRef = { accountKey: 'https://c.example#3', source: 'local' };

/** A moment on the test day, `minutes` past noon, in the wire format. */
export function minute(minutes: number): string {
  return new Date(Date.UTC(2026, 10, 12, 12, minutes)).toISOString();
}

/** A post item fetched by `source`, posted `minutes` past noon. */
export function post(id: string, minutes: number, source: FeedSourceRef): FeedItem {
  return postItem(status(id, { created_at: minute(minutes) }), source);
}

/** A post item fetched by `source` with the wire fields `extras` set. */
export function postWith(
  id: string,
  source: FeedSourceRef,
  extras: Record<string, unknown>,
): FeedItem {
  return postItem(status(id, extras), source);
}

/** The ids of what the items hold, in order. */
export function ids(items: readonly FeedItem[]): string[] {
  return items.map((item) => (item.kind === 'post' ? item.status.id : item.notification.id));
}
