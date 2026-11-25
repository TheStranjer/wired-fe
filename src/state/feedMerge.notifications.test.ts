/**
 * Tests for how the feed merge engine folds notifications: a mention against
 * the same post from home, and every other notification by account and id.
 */

import { describe, expect, it } from 'vitest';

import { type FeedItem, notificationItem } from './feedItem';
import { mergeItems } from './feedMerge';
import type { FeedSourceRef } from './feeds';
import { A_HOME, A_MENTIONS, B_HOME, minute, postWith } from '../test/feedItems';
import { notification, status } from '../test/fixtures';

const MENTIONED = { uri: 'https://x.example/p/1', created_at: minute(10) };

/** A mention notification about the post at `MENTIONED`, delivered to `source`. */
function mention(source: FeedSourceRef): FeedItem {
  return notificationItem(notification('n1', status('m1', MENTIONED)), source);
}

describe('mergeItems mentions', () => {
  it('keeps the notification form of a mention over the same post from home', () => {
    const merged = mergeItems([postWith('h1', A_HOME, MENTIONED)], [mention(A_MENTIONS)]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.kind).toBe('notification');
    expect(merged[0]?.seenBy).toStrictEqual([A_MENTIONS.accountKey]);
  });

  it('keeps the notification when the home post arrives later', () => {
    const merged = mergeItems([mention(A_MENTIONS)], [postWith('h1', B_HOME, MENTIONED)]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.kind).toBe('notification');
    expect(merged[0]?.seenBy).toStrictEqual([A_MENTIONS.accountKey, B_HOME.accountKey]);
  });

  it('records every account that saw the post once the notification wins', () => {
    const merged = mergeItems([postWith('h1', B_HOME, MENTIONED)], [mention(A_MENTIONS)]);

    expect(merged[0]?.kind).toBe('notification');
    expect(merged[0]?.seenBy).toStrictEqual([A_MENTIONS.accountKey, B_HOME.accountKey]);
  });

  it('keeps the first post when a later copy is seen again', () => {
    const merged = mergeItems(
      [postWith('h1', A_HOME, MENTIONED)],
      [postWith('h1', B_HOME, MENTIONED)],
    );

    expect(merged[0]?.kind).toBe('post');
  });

  it('does not fold a notification that is not a mention into its post', () => {
    const favourite = {
      ...notification('n2', status('m1', MENTIONED)),
      kind: 'favourite' as const,
    };
    const merged = mergeItems(
      [postWith('h1', A_HOME, MENTIONED)],
      [notificationItem(favourite, B_HOME)],
    );

    expect(merged).toHaveLength(2);
  });

  it('keeps a mention that carries no post as a notification of its own', () => {
    const bare = { ...notification('n4', null), kind: 'mention' as const };
    const merged = mergeItems([notificationItem(bare, A_HOME)], [notificationItem(bare, A_HOME)]);

    expect(merged).toHaveLength(1);
  });
});

describe('mergeItems notifications', () => {
  it('dedupes a notification by account and id', () => {
    const one = notificationItem(notification('n1', null), A_HOME);
    const again = notificationItem(notification('n1', null), A_MENTIONS);
    const other = notificationItem(notification('n1', null), B_HOME);
    const merged = mergeItems([one], [again, other]);

    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.accountKey).sort()).toStrictEqual([
      A_HOME.accountKey,
      B_HOME.accountKey,
    ]);
  });
});
