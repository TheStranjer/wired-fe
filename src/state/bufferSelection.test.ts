/**
 * Tests for the buffer's selection: which lines it may rest on, moving by a
 * delta and to either end with both ends held in place, the client messages and
 * status-less notifications skipped, a fresh selection taken from the newest
 * line, and every request that changes nothing handing back the same buffer.
 */
import { describe, expect, it } from 'vitest';

import { type Buffer, appendSystem, EMPTY_BUFFER, type NotificationLineData } from './buffer';
import { addStatuses } from './bufferPosts';
import { selectEdge, selectableKeys, selectKey, selectRelative } from './bufferSelection';
import type { Status } from '../api/schemas/status';
import { notification, status, TEST_DATE } from '../test/fixtures';

/** The date every client message carries. */
const DATE = new Date(TEST_DATE);

/** `buffer` with a client message keyed `sys:<seq>` appended. */
function say(buffer: Buffer, seq: number): Buffer {
  return appendSystem(buffer, { date: DATE, level: 'info', text: 'l' }, seq);
}

/** Posts a, b and c: a client message above them, one between b and c. */
function mixed(): Buffer {
  const older = addStatuses(say(EMPTY_BUFFER, 0), [status('b'), status('a')], 'newer');
  return addStatuses(say(older, 1), [status('c')], 'newer');
}

/** A notification line keyed `nt:<id>`, as the notifications window holds them. */
function notificationLine(id: string, shown: Status | null): NotificationLineData {
  return {
    kind: 'notification',
    key: `nt:${id}`,
    notification: notification(id, shown),
    accountKey: null,
  };
}

/** {@link mixed} with a mention carrying a status and a follow request carrying none. */
function notifying(): Buffer {
  const buffer = mixed();
  return {
    ...buffer,
    lines: [...buffer.lines, notificationLine('31', status('m1')), notificationLine('32', null)],
  };
}

describe(selectableKeys, () => {
  it('lists the post lines top to bottom, skipping the client messages', () => {
    expect(mixed().lines.map((line) => line.key)).toStrictEqual([
      'sys:0',
      'post:a',
      'post:b',
      'sys:1',
      'post:c',
    ]);
    expect(selectableKeys(mixed())).toStrictEqual(['post:a', 'post:b', 'post:c']);
  });

  it('takes a notification that carried a status and skips one that did not', () => {
    expect(selectableKeys(notifying())).toStrictEqual(['post:a', 'post:b', 'post:c', 'nt:31']);
  });

  it('comes back empty when nothing carries a status', () => {
    expect(selectableKeys(EMPTY_BUFFER)).toStrictEqual([]);
    expect(selectableKeys(say(EMPTY_BUFFER, 0))).toStrictEqual([]);
  });
});

describe(selectKey, () => {
  it('puts the selection on a line and keeps the rest of the buffer', () => {
    const before: Buffer = { ...mixed(), load: 'loaded', olderCursor: { max_id: '42' } };
    const after = selectKey(before, 'post:b');

    expect(after).not.toBe(before);
    expect(after.selectedKey).toBe('post:b');
    expect(after.load).toBe('loaded');
    expect(after.olderCursor).toStrictEqual({ max_id: '42' });
    expect(before.selectedKey).toBeNull();
  });

  it('selects a notification line that carries a status', () => {
    expect(selectKey(notifying(), 'nt:31').selectedKey).toBe('nt:31');
  });

  it('leaves the buffer alone for a client message and a status-less notification', () => {
    const buffer = notifying();

    expect(selectKey(buffer, 'sys:0')).toBe(buffer);
    expect(selectKey(buffer, 'nt:32')).toBe(buffer);
  });

  it('leaves the buffer alone for a key the scrollback does not hold', () => {
    const buffer = mixed();

    expect(selectKey(buffer, 'post:gone')).toBe(buffer);
    expect(selectKey(EMPTY_BUFFER, 'post:a')).toBe(EMPTY_BUFFER);
  });

  it('leaves the buffer alone once the line is already selected', () => {
    const selected = selectKey(mixed(), 'post:a');

    expect(selectKey(selected, 'post:a')).toBe(selected);
  });

  it('clears the selection for null and leaves an empty one alone', () => {
    const selected = selectKey(mixed(), 'post:a');
    const unselected = mixed();

    expect(selectKey(selected, null).selectedKey).toBeNull();
    expect(selectKey(selected, null)).not.toBe(selected);
    expect(selectKey(unselected, null)).toBe(unselected);
    expect(selectKey(EMPTY_BUFFER, null)).toBe(EMPTY_BUFFER);
  });
});

describe(selectRelative, () => {
  it('selects the newest selectable line while nothing is selected', () => {
    expect(selectRelative(mixed(), 1).selectedKey).toBe('post:c');
    expect(selectRelative(mixed(), -1).selectedKey).toBe('post:c');
    expect(selectRelative(notifying(), 1).selectedKey).toBe('nt:31');
  });

  it('steps down towards the newest line and up towards the oldest', () => {
    const onA = selectKey(mixed(), 'post:a');
    const onC = selectKey(mixed(), 'post:c');

    expect(selectRelative(onA, 1).selectedKey).toBe('post:b');
    expect(selectRelative(onA, 2).selectedKey).toBe('post:c');
    expect(selectRelative(onC, -1).selectedKey).toBe('post:b');
    expect(selectRelative(onC, -2).selectedKey).toBe('post:a');
  });

  it('steps over the client message standing between two posts', () => {
    const onB = selectKey(mixed(), 'post:b');

    expect(selectRelative(onB, 1).selectedKey).toBe('post:c');
    expect(selectRelative(onB, -1).selectedKey).toBe('post:a');
  });

  it('holds the selection at the ends and hands back the same buffer there', () => {
    const oldest = selectEdge(mixed(), 'first');
    const newest = selectEdge(mixed(), 'last');

    expect(selectRelative(oldest, -9).selectedKey).toBe('post:a');
    expect(selectRelative(oldest, -9)).toBe(oldest);
    expect(selectRelative(newest, 9).selectedKey).toBe('post:c');
    expect(selectRelative(newest, 9)).toBe(newest);
  });

  it('crosses the lines it passes when one step goes further', () => {
    expect(selectRelative(selectKey(mixed(), 'post:a'), 9).selectedKey).toBe('post:c');
    expect(selectRelative(selectKey(mixed(), 'post:c'), -9).selectedKey).toBe('post:a');
  });

  it('leaves the buffer alone for a move that stays where it is', () => {
    const buffer = selectKey(mixed(), 'post:b');

    expect(selectRelative(buffer, 0)).toBe(buffer);
  });

  it('leaves a buffer with nothing to select alone', () => {
    const buffer = say(EMPTY_BUFFER, 0);

    expect(selectRelative(buffer, 1)).toBe(buffer);
    expect(selectRelative(EMPTY_BUFFER, -1)).toBe(EMPTY_BUFFER);
  });

  it('takes the newest line when the selected one has scrolled out', () => {
    const stale: Buffer = { ...mixed(), selectedKey: 'post:gone' };

    expect(selectRelative(stale, 1).selectedKey).toBe('post:c');
    expect(selectRelative(stale, -1).selectedKey).toBe('post:c');
  });
});

describe(selectEdge, () => {
  it('selects the oldest and the newest selectable line', () => {
    expect(selectEdge(mixed(), 'first').selectedKey).toBe('post:a');
    expect(selectEdge(mixed(), 'last').selectedKey).toBe('post:c');
    expect(selectEdge(notifying(), 'first').selectedKey).toBe('post:a');
    expect(selectEdge(notifying(), 'last').selectedKey).toBe('nt:31');
  });

  it('leaves a buffer already at that edge alone', () => {
    const oldest = selectEdge(mixed(), 'first');

    expect(selectEdge(oldest, 'first')).toBe(oldest);
    expect(selectEdge(oldest, 'last')).not.toBe(oldest);
  });

  it('leaves a buffer holding only client messages alone', () => {
    const buffer = say(EMPTY_BUFFER, 0);

    expect(selectEdge(buffer, 'first')).toBe(buffer);
    expect(selectEdge(EMPTY_BUFFER, 'last')).toBe(EMPTY_BUFFER);
  });
});
