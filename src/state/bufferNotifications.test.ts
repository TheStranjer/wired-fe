/**
 * Tests for addNotifications and removeNotification: a page arrives
 * newest-first and joins the scrollback oldest-first — appended when newer,
 * prepended when older — skipping ids the buffer already shows and repeats
 * inside the page; a notification carrying a status labels that status, a
 * status-less one labels nothing, and one already labelled by a post keeps its
 * label. Removal takes the line off and clears a selection standing on it,
 * and a request that matches nothing hands back the very same buffer.
 */
import { describe, expect, it } from 'vitest';

import {
  type Buffer,
  EMPTY_BUFFER,
  type NotificationLineData,
  SCROLLBACK_LIMIT,
  type SystemLineData,
} from './buffer';
import { addNotifications, removeNotification } from './bufferNotifications';
import { addStatuses } from './bufferPosts';
import type { Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';
import { notification, status, TEST_DATE } from '../test/fixtures';
import type { LabelBook } from '../windows/labels';

/** A client-message line keyed `sys:<seq>`, to stand beside the notifications. */
function systemLine(seq: number): SystemLineData {
  return {
    kind: 'system',
    key: `sys:${String(seq)}`,
    date: new Date(TEST_DATE),
    level: 'info',
    text: 'l',
  };
}

/** A notification line keyed `notif:<id>`, as addNotifications builds them. */
function notifLine(id: string, shown: Status | null): NotificationLineData {
  return {
    kind: 'notification',
    key: `notif:${id}`,
    notification: notification(id, shown),
    accountKey: null,
  };
}

/** A buffer holding one client line, so the notifications join around something. */
function seeded(): Buffer {
  return { ...EMPTY_BUFFER, lines: [systemLine(0)] };
}

/** The buffer's line keys, top to bottom. */
function keys(buffer: Buffer): string[] {
  return buffer.lines.map((line) => line.key);
}

/** The notification of the line at `at`; the tests put lines where they look. */
function notificationAt(buffer: Buffer, at: number): Notification {
  const line = buffer.lines[at];

  if (line?.kind !== 'notification') {
    throw new RangeError(`no notification line at ${String(at)}`);
  }
  return line.notification;
}

/** The book's id-to-label pairs, as a plain object for one-line assertions. */
function labels(book: LabelBook): Record<string, string | undefined> {
  return Object.fromEntries(book.byId);
}

describe(addNotifications, () => {
  it('appends a newer page in chronological order, under the lines it has', () => {
    const page = [notification('n3', null), notification('n2', null), notification('n1', null)];

    const after = addNotifications(seeded(), page, 'newer');

    expect(keys(after)).toStrictEqual(['sys:0', 'notif:n1', 'notif:n2', 'notif:n3']);
    expect(notificationAt(after, 3).id).toBe('n3');
  });

  it('prepends an older page in chronological order, above the lines it has', () => {
    const page = [notification('o3', null), notification('o2', null), notification('o1', null)];

    const after = addNotifications(seeded(), page, 'older');

    expect(keys(after)).toStrictEqual(['notif:o1', 'notif:o2', 'notif:o3', 'sys:0']);
    expect(notificationAt(after, 0).id).toBe('o1');
  });

  it('labels the statuses a page carries, in the order their lines join', () => {
    const page = [
      notification('n3', status('s3')),
      notification('n2', null),
      notification('n1', status('s1')),
    ];

    const after = addNotifications(EMPTY_BUFFER, page, 'newer');

    expect(labels(after.labels)).toStrictEqual({ s1: 'a0', s3: 'a1' });
    expect(after.labels.next).toBe(2);
  });

  it('gives a status-less follow no label at all', () => {
    const after = addNotifications(EMPTY_BUFFER, [notification('n1', null)], 'newer');

    expect(after.labels).toBe(EMPTY_BUFFER.labels);
    expect(after.labels.next).toBe(0);
  });

  it('keeps the label a post line already gave a status a notification carries', () => {
    const shared = status('s');
    const withPost = addStatuses(EMPTY_BUFFER, [shared], 'newer');

    const after = addNotifications(withPost, [notification('n1', shared)], 'newer');

    expect(keys(after)).toStrictEqual(['post:s', 'notif:n1']);
    expect(labels(after.labels)).toStrictEqual({ s: 'a0' });
    expect(after.labels.next).toBe(1);
  });

  it('skips ids the buffer already shows and repeats inside the page', () => {
    const first = addNotifications(
      EMPTY_BUFFER,
      [notification('b', null), notification('a', null)],
      'newer',
    );

    const after = addNotifications(
      first,
      [notification('c', null), notification('b', null), notification('b', null)],
      'newer',
    );

    expect(keys(after)).toStrictEqual(['notif:a', 'notif:b', 'notif:c']);
  });

  it('returns the same buffer when every notification is a duplicate', () => {
    const first = addNotifications(EMPTY_BUFFER, [notification('a', status('s'))], 'newer');

    expect(addNotifications(first, [notification('a', status('s'))], 'older')).toBe(first);
    expect(addNotifications(first, [], 'newer')).toBe(first);
  });

  it('keeps the rest of the buffer and does not touch the one it was given', () => {
    const before: Buffer = {
      ...seeded(),
      selectedKey: 'sys:0',
      load: 'loaded',
      olderCursor: { max_id: '42' },
    };

    const after = addNotifications(before, [notification('n1', null)], 'newer');

    expect(after).not.toBe(before);
    expect(after.selectedKey).toBe('sys:0');
    expect(after.olderCursor).toStrictEqual({ max_id: '42' });
    expect(before.lines).toHaveLength(1);
  });

  it('caps the scrollback when a page pushes past the limit', () => {
    const full: Buffer = {
      ...EMPTY_BUFFER,
      lines: Array.from({ length: SCROLLBACK_LIMIT - 4 }, (_gap, seq) => systemLine(seq)),
    };
    const page = ['n5', 'n4', 'n3', 'n2', 'n1'].map((id) => notification(id, null));

    const after = addNotifications(full, page, 'newer');

    expect(after.lines).toHaveLength(SCROLLBACK_LIMIT);
    expect(after.lines[0]?.key).toBe('sys:1');
    expect(after.lines.at(-1)?.key).toBe('notif:n5');
  });
});

describe(removeNotification, () => {
  it('takes the notification line off and leaves the other lines alone', () => {
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [
        systemLine(0),
        notifLine('gone', null),
        notifLine('keep', status('s')),
        { kind: 'post', key: 'post:gone', status: status('gone'), accountKey: null },
      ],
    };

    const after = removeNotification(buffer, 'gone');

    expect(keys(after)).toStrictEqual(['sys:0', 'notif:keep', 'post:gone']);
    expect(buffer.lines).toHaveLength(4);
  });

  it('clears the selection when it stood on the removed line, retiring no label', () => {
    const shown = addNotifications(
      EMPTY_BUFFER,
      [notification('gone', status('s')), notification('keep', status('t'))],
      'newer',
    );
    const buffer: Buffer = { ...shown, selectedKey: 'notif:gone' };

    const after = removeNotification(buffer, 'gone');

    expect(keys(after)).toStrictEqual(['notif:keep']);
    expect(after.selectedKey).toBeNull();
    expect(after.labels).toBe(shown.labels);
  });

  it('keeps a selection standing on a line that stays', () => {
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [notifLine('gone', null), notifLine('keep', null)],
      selectedKey: 'notif:keep',
    };

    const after = removeNotification(buffer, 'gone');

    expect(after.selectedKey).toBe('notif:keep');
  });

  it('returns the same buffer when no line carries the id', () => {
    const buffer: Buffer = { ...EMPTY_BUFFER, lines: [notifLine('a', null)] };

    expect(removeNotification(buffer, 'gone')).toBe(buffer);
    expect(removeNotification(EMPTY_BUFFER, 'gone')).toBe(EMPTY_BUFFER);
  });
});
