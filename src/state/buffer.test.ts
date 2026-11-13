/**
 * Tests for the per-window line buffer: appending client messages and their
 * `sys:<seq>` keys, the scrollback cap at SCROLLBACK_LIMIT, what clearing a
 * buffer keeps, and that no transition touches the buffer it was given.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  type Buffer,
  type BufferLoad,
  type LineData,
  type LineLevel,
  type NotificationLineData,
  type PostLineData,
  type SystemLineData,
  appendSystem,
  capLines,
  clearBuffer,
  EMPTY_BUFFER,
  SCROLLBACK_LIMIT,
} from './buffer';
import wiredFixture from '../api/fixtures/status/wired.json';
import { NotificationSchema } from '../api/schemas/notification';
import { StatusSchema } from '../api/schemas/status';
import { assignLabel, EMPTY_LABEL_BOOK } from '../windows/labels';

/** The moment every test line is stamped with, so dates compare by value. */
const DATE = new Date('2026-11-12T21:14:05.000Z');

/** A status parsed from the recorded Wired fixture, for the post lines. */
const STATUS = v.parse(StatusSchema, wiredFixture);

/** That status as the mention that carried it, for the notification lines. */
const NOTIFICATION = v.parse(NotificationSchema, {
  id: '31',
  type: 'mention',
  created_at: STATUS.created_at,
  account: STATUS.account,
  status: STATUS,
});

/** A system line with key `sys:<seq>`, built the way the buffer holds them. */
function systemLine(seq: number, level: LineLevel = 'info'): SystemLineData {
  return {
    kind: 'system',
    key: `sys:${String(seq)}`,
    date: DATE,
    level,
    text: `line ${String(seq)}`,
  };
}

/** `count` system lines, keys `sys:0` to one below `count`. */
function systemLines(count: number): SystemLineData[] {
  return Array.from({ length: count }, (_gap, seq) => systemLine(seq));
}

/** A post line with `key`. */
function postLine(key: string): PostLineData {
  return { kind: 'post', key, status: STATUS };
}

/** A notification line with `key`. */
function notificationLine(key: string): NotificationLineData {
  return { kind: 'notification', key, notification: NOTIFICATION };
}

/** A buffer in mid-chronicle: lines of every kind, labelled, selected, paging. */
function busyBuffer(): Buffer {
  const [labels] = assignLabel(EMPTY_LABEL_BOOK, 'post-1');
  return {
    ...EMPTY_BUFFER,
    lines: [systemLine(0), postLine('st:7'), notificationLine('nt:31')],
    labels,
    selectedKey: 'st:7',
    revealed: new Set(['st:7']),
    load: 'loaded',
    olderCursor: { max_id: '42' },
    exhausted: true,
    olderRequests: 2,
  };
}

describe('the empty buffer', () => {
  it('starts a window that has shown and fetched nothing', () => {
    expect(EMPTY_BUFFER).toStrictEqual({
      lines: [],
      labels: EMPTY_LABEL_BOOK,
      selectedKey: null,
      revealed: new Set<string>(),
      load: 'idle',
      olderCursor: null,
      exhausted: false,
      olderRequests: 0,
    } satisfies Buffer);
  });
});

describe(appendSystem, () => {
  it('appends the line at the bottom, keyed sys:<seq>', () => {
    const first = appendSystem(EMPTY_BUFFER, { date: DATE, level: 'warn', text: 'hi' }, 3);
    const buffer = appendSystem(first, { date: DATE, level: 'info', text: 'again' }, 4);

    expect(buffer.lines.map((line) => line.key)).toStrictEqual(['sys:3', 'sys:4']);
    expect(first.lines[0]).toStrictEqual({
      kind: 'system',
      key: 'sys:3',
      date: DATE,
      level: 'warn',
      text: 'hi',
    } satisfies SystemLineData);
  });

  it('keeps the labels book, the selection and the paging fields', () => {
    const before = busyBuffer();
    const after = appendSystem(before, { date: DATE, level: 'info', text: 'hello' }, 4);

    expect(after.labels).toBe(before.labels);
    expect(after.revealed).toBe(before.revealed);
    expect(after.selectedKey).toBe('st:7');
    expect(after.load).toBe('loaded');
    expect(after.olderRequests).toBe(2);
  });

  it('drops the oldest line once a thousand and one appends pass the cap', () => {
    let buffer = EMPTY_BUFFER;
    for (let seq = 0; seq <= SCROLLBACK_LIMIT; seq += 1) {
      buffer = appendSystem(
        buffer,
        { date: DATE, level: 'info', text: `line ${String(seq)}` },
        seq,
      );
    }

    expect(buffer.lines).toHaveLength(SCROLLBACK_LIMIT);
    expect(buffer.lines[0]?.key).toBe('sys:1');
    expect(buffer.lines.at(-1)?.key).toBe(`sys:${String(SCROLLBACK_LIMIT)}`);
  });

  it('does not mutate the buffer it was given', () => {
    const before = busyBuffer();
    const lines = before.lines;

    appendSystem(before, { date: DATE, level: 'info', text: 'appended' }, 9);

    expect(before.lines).toBe(lines);
    expect(before.lines).toHaveLength(3);
  });
});

describe(capLines, () => {
  it('keeps a list of the limit or fewer as it is', () => {
    const three = systemLines(3);
    const full = systemLines(SCROLLBACK_LIMIT);

    expect(capLines(three).map((line) => line.key)).toStrictEqual(['sys:0', 'sys:1', 'sys:2']);
    expect(capLines(full)).toHaveLength(SCROLLBACK_LIMIT);
    expect(capLines(full)[0]?.key).toBe('sys:0');
  });

  it('keeps the last lines and drops the oldest past the limit', () => {
    const capped = capLines(systemLines(SCROLLBACK_LIMIT + 1));

    expect(capped).toHaveLength(SCROLLBACK_LIMIT);
    expect(capped[0]?.key).toBe('sys:1');
    expect(capped.at(-1)?.key).toBe(`sys:${String(SCROLLBACK_LIMIT)}`);
  });

  it('caps lines of every kind by age, not by kind', () => {
    const mixed: LineData[] = [
      ...systemLines(SCROLLBACK_LIMIT),
      postLine('st:7'),
      notificationLine('nt:31'),
    ];
    const capped = capLines(mixed);

    expect(capped[0]?.key).toBe('sys:2');
    expect(capped.at(-2)?.key).toBe('st:7');
    expect(capped.at(-1)).toStrictEqual(notificationLine('nt:31'));
  });

  it('does not touch the list it was given', () => {
    const lines = systemLines(SCROLLBACK_LIMIT + 1);

    capLines(lines);

    expect(lines).toHaveLength(SCROLLBACK_LIMIT + 1);
    expect(lines[0]?.key).toBe('sys:0');
  });
});

describe(clearBuffer, () => {
  it('empties the lines and the selection with them', () => {
    const cleared = clearBuffer(busyBuffer());

    expect(cleared.lines).toStrictEqual([]);
    expect(cleared.selectedKey).toBeNull();
    expect(cleared.revealed.size).toBe(0);
  });

  it('keeps the labels, the load state and the paging into older history', () => {
    const before = busyBuffer();
    const cleared = clearBuffer(before);

    expect(cleared.labels).toBe(before.labels);
    expect(cleared.labels.next).toBe(1);
    expect(cleared.olderCursor).toStrictEqual({ max_id: '42' });
    expect(cleared.exhausted).toBe(true);
    expect(cleared.olderRequests).toBe(2);
  });

  it('keeps whichever of the four load states it had', () => {
    const loads: readonly BufferLoad[] = ['idle', 'loading', 'loaded', 'error'];

    expect(loads.map((load) => clearBuffer({ ...EMPTY_BUFFER, load }).load)).toStrictEqual(loads);
  });

  it('does not mutate the buffer it was given', () => {
    const before = busyBuffer();
    const lines = before.lines;

    clearBuffer(before);

    expect(before.lines).toBe(lines);
    expect(before.lines).toHaveLength(3);
    expect(before.revealed.has('st:7')).toBe(true);
  });
});
