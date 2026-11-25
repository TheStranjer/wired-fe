/**
 * Tests for the feed merge engine's ordering and its dedupe of posts across
 * accounts. Notifications and the paging boundary have their own files.
 */

import { describe, expect, it } from 'vitest';

import { notificationItem } from './feedItem';
import { mergeItems, sourceKey } from './feedMerge';
import type { FeedSourceRef } from './feeds';
import { A_HOME, A_MENTIONS, B_HOME, C_LOCAL, ids, post, postWith } from '../test/feedItems';
import { notification } from '../test/fixtures';

describe(sourceKey, () => {
  it('joins the account key and the source', () => {
    expect(sourceKey(B_HOME)).toBe('https://b.example#2|home');
  });
});

describe('mergeItems ordering', () => {
  it('interleaves three sources newest first', () => {
    const merged = mergeItems(
      [post('a1', 50, A_HOME), post('a2', 10, A_HOME)],
      [
        post('b1', 40, B_HOME),
        post('b2', 20, B_HOME),
        post('c1', 30, C_LOCAL),
        post('c2', 5, C_LOCAL),
      ],
    );

    expect(ids(merged)).toStrictEqual(['a1', 'b1', 'c1', 'b2', 'a2', 'c2']);
  });

  it('merges into what is already there', () => {
    const first = mergeItems([], [post('a1', 10, A_HOME)]);

    expect(ids(mergeItems(first, [post('a2', 20, A_HOME)]))).toStrictEqual(['a2', 'a1']);
  });

  it('breaks a tie in time by source key, then by id', () => {
    const merged = mergeItems(
      [post('z', 10, B_HOME), post('y', 10, A_HOME), post('b', 10, A_HOME), post('a', 10, A_HOME)],
      [],
    );

    expect(ids(merged)).toStrictEqual(['a', 'b', 'y', 'z']);
  });

  it('keeps two different items that share source, time and id', () => {
    const follow = notification('x', null);
    const merged = mergeItems(
      [notificationItem(follow, A_HOME)],
      [postWith('x', A_HOME, { created_at: follow.created_at })],
    );

    expect(merged).toHaveLength(2);
  });

  it('orders by the moment, not by the text of the date', () => {
    const early = postWith('early', A_HOME, { created_at: '2026-11-12T12:00:00.000Z' });
    const late = postWith('late', A_HOME, { created_at: '2026-11-12T13:30:00.000+02:00' });

    expect(ids(mergeItems([early], [late]))).toStrictEqual(['early', 'late']);
  });

  it('puts a date that does not parse last', () => {
    const broken = postWith('broken', A_HOME, { created_at: 'not a date' });
    const merged = mergeItems([broken], [post('ok', 1, A_HOME)]);

    expect(ids(merged)).toStrictEqual(['ok', 'broken']);
  });
});

describe('mergeItems posts', () => {
  const SHARED = { uri: 'https://x.example/p/1' };

  it('shows a post seen by two accounts once, acting account first', () => {
    const merged = mergeItems([postWith('a1', A_HOME, SHARED)], [postWith('b9', B_HOME, SHARED)]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.accountKey).toBe(A_HOME.accountKey);
    expect(merged[0]?.seenBy).toStrictEqual([A_HOME.accountKey, B_HOME.accountKey]);
  });

  it('records an account once however often it sees the post', () => {
    const first = mergeItems([postWith('a1', A_HOME, SHARED)], [postWith('b9', B_HOME, SHARED)]);
    const merged = mergeItems(first, [
      postWith('a1', A_MENTIONS, SHARED),
      postWith('a1', A_HOME, SHARED),
    ]);

    expect(merged[0]?.seenBy).toStrictEqual([A_HOME.accountKey, B_HOME.accountKey]);
  });

  it('falls back to the url when the uri is empty', () => {
    const shared = { uri: '', url: 'https://x.example/@lain/1' };
    const merged = mergeItems([postWith('a1', A_HOME, shared)], [postWith('b9', B_HOME, shared)]);

    expect(merged).toHaveLength(1);
  });

  it('falls back to the id on the same instance when there is no uri or url', () => {
    const bare = { uri: '', url: null };
    const merged = mergeItems([postWith('7', A_HOME, bare)], [postWith('7', A_MENTIONS, bare)]);

    expect(merged).toHaveLength(1);
  });

  it('keeps posts with the same id from different instances apart', () => {
    const bare = { uri: '', url: '' };
    const merged = mergeItems([postWith('7', A_HOME, bare)], [postWith('7', B_HOME, bare)]);

    expect(merged).toHaveLength(2);
  });

  it('reads an account key without an origin separator as its own origin', () => {
    const loose: FeedSourceRef = { accountKey: 'loose', source: 'home' };
    const bare = { uri: '', url: null };
    const merged = mergeItems([postWith('7', loose, bare)], [postWith('7', loose, bare)]);

    expect(merged).toHaveLength(1);
  });
});
