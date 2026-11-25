/**
 * Tests for setFeedLines: the stream arrives newest first and the scrollback
 * reads oldest first, each line records its item's account, ids are labelled
 * in line order and keep their labels when the stream is shown again, client
 * messages stay at the bottom, and a clash of keys or an overflowing stream
 * is settled.
 */
import { describe, expect, it } from 'vitest';

import { appendSystem, EMPTY_BUFFER, SCROLLBACK_LIMIT } from './buffer';
import { setFeedLines } from './bufferFeed';
import { notificationItem, postItem } from './feedItem';
import { A_HOME, B_HOME, post } from '../test/feedItems';
import { notification, status, TEST_DATE } from '../test/fixtures';
import { labelForId, labelForIndex } from '../windows/labels';

/** A buffer whose one client message is already on the scrollback. */
const WITH_MESSAGE = appendSystem(
  EMPTY_BUFFER,
  { date: new Date(TEST_DATE), level: 'info', text: 'hello' },
  1,
);

describe(setFeedLines, () => {
  it('shows the stream oldest first, each line as its own account', () => {
    const next = setFeedLines(EMPTY_BUFFER, [post('new', 5, B_HOME), post('old', 1, A_HOME)]);

    expect(next.lines.map((line) => line.key)).toStrictEqual(['post:old', 'post:new']);
    expect(
      next.lines.map((line) => (line.kind === 'system' ? null : line.accountKey)),
    ).toStrictEqual([A_HOME.accountKey, B_HOME.accountKey]);
  });

  it('records every account that saw a post or a notification on its line', () => {
    const seen = [A_HOME.accountKey, B_HOME.accountKey];
    const items = [
      { ...post('p', 5, A_HOME), seenBy: seen },
      { ...notificationItem(notification('n', null), B_HOME), seenBy: seen },
    ];
    const next = setFeedLines(EMPTY_BUFFER, items);

    expect(next.lines.map((line) => (line.kind === 'system' ? null : line.seenBy))).toStrictEqual([
      seen,
      seen,
    ]);
  });

  it('labels ids in line order and keeps the labels when shown again', () => {
    const first = setFeedLines(EMPTY_BUFFER, [post('b', 5, A_HOME), post('a', 1, A_HOME)]);

    expect(labelForId(first.labels, 'a')).toBe(labelForIndex(0));
    expect(labelForId(first.labels, 'b')).toBe(labelForIndex(1));

    const again = setFeedLines(first, [post('c', 9, A_HOME), post('b', 5, A_HOME)]);

    expect(labelForId(again.labels, 'b')).toBe(labelForIndex(1));
    expect(labelForId(again.labels, 'c')).toBe(labelForIndex(2));
    expect(again.lines.map((line) => line.key)).toStrictEqual(['post:b', 'post:c']);
  });

  it('labels the quote a post shows and the post a notification carries', () => {
    const quoter = postItem(status('q', { quote: status('inner') }), A_HOME);
    const mention = notificationItem(notification('n', status('about')), A_HOME);
    const follow = notificationItem(notification('f', null), A_HOME);
    const next = setFeedLines(EMPTY_BUFFER, [quoter, mention, follow]);

    expect(next.labels.byId.size).toBe(3);
    expect(labelForId(next.labels, 'inner')).toBeDefined();
    expect(labelForId(next.labels, 'about')).toBeDefined();
  });

  it('keys a notification by its account and id, so two accounts never clash', () => {
    const items = [
      notificationItem(notification('7', null), A_HOME),
      notificationItem(notification('7', null), B_HOME),
    ];
    const next = setFeedLines(EMPTY_BUFFER, items);

    expect(next.lines.map((line) => line.kind)).toStrictEqual(['notification', 'notification']);
    expect(new Set(next.lines.map((line) => line.key)).size).toBe(2);
  });

  it('keeps client messages, after the stream', () => {
    const next = setFeedLines(WITH_MESSAGE, [post('a', 1, A_HOME)]);

    expect(next.lines.map((line) => line.kind)).toStrictEqual(['post', 'system']);
  });

  it('shows the earlier in the stream of two items with one status id', () => {
    const first = postItem(status('same', { content: '<p>first</p>' }), A_HOME);
    const second = postItem(status('same', { content: '<p>second</p>' }), B_HOME);
    const next = setFeedLines(EMPTY_BUFFER, [first, second]);

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]).toMatchObject({ accountKey: A_HOME.accountKey });
  });

  it('caps the scrollback, keeping the newest', () => {
    const items = Array.from({ length: SCROLLBACK_LIMIT + 2 }, (_, index) =>
      post(`p${String(index)}`, 0, A_HOME),
    );
    const next = setFeedLines(EMPTY_BUFFER, items);

    expect(next.lines).toHaveLength(SCROLLBACK_LIMIT);
    expect(next.lines.at(-1)?.key).toBe('post:p0');
  });
});
