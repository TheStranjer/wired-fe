/**
 * Tests for addStatuses: a page arrives newest-first and joins the scrollback
 * oldest-first — appended when newer, prepended when older — skipping ids the
 * buffer already shows and repeats inside the page, labelling each addition in
 * join order, capping the result, and handing the very same buffer back when
 * nothing in the page is new.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type Buffer, EMPTY_BUFFER, SCROLLBACK_LIMIT, type SystemLineData } from './buffer';
import { addStatuses } from './bufferPosts';
import { StatusSchema, type Status } from '../api/schemas/status';
import type { LabelBook } from '../windows/labels';

/** The moment every test status is stamped with. */
const DATE = '2026-11-12T21:14:05.000Z';

/** The author every test status shares, in the shape the schema reads. */
const ACCOUNT = {
  id: '1',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain',
  created_at: DATE,
  note: '<p>hi</p>',
  url: 'https://wired.example/@lain',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** A status parsed from the smallest wire object the schema accepts, plus `extras`. */
function status(id: string, extras: Record<string, unknown> = {}): Status {
  return v.parse(StatusSchema, {
    id,
    uri: `https://wired.example/n/${id}`,
    created_at: DATE,
    account: ACCOUNT,
    content: `<p>${id}</p>`,
    visibility: 'public',
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    ...extras,
  });
}

/** A client-message line keyed `sys:<seq>`, to stand beside the posts. */
function systemLine(seq: number): SystemLineData {
  const n = String(seq);

  return { kind: 'system', key: `sys:${n}`, date: new Date(DATE), level: 'info', text: 'l' };
}

/** A buffer holding one client line, so the posts join around something. */
function seeded(): Buffer {
  return { ...EMPTY_BUFFER, lines: [systemLine(0)] };
}

/** The buffer's line keys, top to bottom. */
function keys(buffer: Buffer): string[] {
  return buffer.lines.map((line) => line.key);
}

/** The status of the post line at `at`; the tests put post lines where they look. */
function statusAt(buffer: Buffer, at: number): Status {
  const line = buffer.lines[at];

  if (line?.kind !== 'post') {
    throw new RangeError(`no post line at ${String(at)}`);
  }
  return line.status;
}

/** The book's id-to-label pairs, as a plain object for one-line assertions. */
function labels(book: LabelBook): Record<string, string | undefined> {
  return Object.fromEntries(book.byId);
}

describe(addStatuses, () => {
  it('appends a newer page in chronological order, under the lines it has', () => {
    const after = addStatuses(seeded(), [status('p3'), status('p2'), status('p1')], 'newer');

    expect(keys(after)).toStrictEqual(['sys:0', 'post:p1', 'post:p2', 'post:p3']);
    expect(statusAt(after, 3).id).toBe('p3');
  });

  it('prepends an older page in chronological order, above the lines it has', () => {
    const after = addStatuses(seeded(), [status('o3'), status('o2'), status('o1')], 'older');

    expect(keys(after)).toStrictEqual(['post:o1', 'post:o2', 'post:o3', 'sys:0']);
    expect(statusAt(after, 0).id).toBe('o1');
  });

  it('labels the added statuses a0, a1, … in the order they join', () => {
    const after = addStatuses(EMPTY_BUFFER, [status('p3'), status('p2'), status('p1')], 'newer');

    expect(labels(after.labels)).toStrictEqual({ p1: 'a0', p2: 'a1', p3: 'a2' });
    expect(after.labels.next).toBe(3);
  });

  it('keeps labelling across pages, so an older page continues the book', () => {
    const first = addStatuses(EMPTY_BUFFER, [status('n2'), status('n1')], 'newer');

    const after = addStatuses(first, [status('o2'), status('o1')], 'older');

    expect(labels(after.labels)).toStrictEqual({ n1: 'a0', n2: 'a1', o1: 'a2', o2: 'a3' });
  });

  it('skips ids the buffer already shows and repeats inside the page', () => {
    const first = addStatuses(EMPTY_BUFFER, [status('b'), status('a')], 'newer');

    const after = addStatuses(first, [status('c'), status('b'), status('b')], 'newer');

    expect(keys(after)).toStrictEqual(['post:a', 'post:b', 'post:c']);
    expect(after.labels.byId.get('c')).toBe('a2');
    expect(after.labels.next).toBe(3);
  });

  it('returns the same buffer when every status is a duplicate', () => {
    const first = addStatuses(EMPTY_BUFFER, [status('a')], 'newer');

    expect(addStatuses(first, [status('a'), status('a')], 'older')).toBe(first);
    expect(addStatuses(first, [], 'newer')).toBe(first);
  });

  it('keeps the rest of the buffer and does not touch the one it was given', () => {
    const before: Buffer = {
      ...seeded(),
      selectedKey: 'sys:0',
      load: 'loaded',
      olderCursor: { max_id: '42' },
    };

    const after = addStatuses(before, [status('a')], 'newer');

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
    const page = ['p5', 'p4', 'p3', 'p2', 'p1'].map((id) => status(id));

    const after = addStatuses(full, page, 'newer');

    expect(after.lines).toHaveLength(SCROLLBACK_LIMIT);
    expect(after.lines[0]?.key).toBe('sys:1');
    expect(after.lines.at(-1)?.key).toBe('post:p5');
  });
});
