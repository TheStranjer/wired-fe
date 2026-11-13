/**
 * Tests for replaceStatus and removeStatus: a changed status takes the place of
 * every line showing it, directly or inside a boost; a deleted status comes off
 * every such line and clears the selection when it stood there; and a status no
 * line shows leaves the very same buffer behind.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type Buffer, EMPTY_BUFFER, type PostLineData, type SystemLineData } from './buffer';
import { removeStatus, replaceStatus } from './bufferPosts';
import { StatusSchema, type Status } from '../api/schemas/status';

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
  return {
    kind: 'system',
    key: `sys:${String(seq)}`,
    date: new Date(DATE),
    level: 'info',
    text: 'l',
  };
}

/** A post line keyed `post:<id>`, as addStatuses builds them. */
function postLine(id: string, shown: Status): PostLineData {
  return { kind: 'post', key: `post:${id}`, status: shown };
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

describe(replaceStatus, () => {
  it('swaps a status shown directly for its new self', () => {
    const buffer: Buffer = { ...EMPTY_BUFFER, lines: [postLine('a', status('a'))] };

    const edited = status('a', { content: '<p>edited</p>', favourited: true });
    const after = replaceStatus(buffer, edited);

    expect(statusAt(after, 0)).toBe(edited);
    expect(after).not.toBe(buffer);
    expect(statusAt(buffer, 0).content).toBe('<p>a</p>');
  });

  it('swaps a boosted status for its new self inside the boost', () => {
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [postLine('b', status('b', { reblog: status('s') }))],
    };

    const edited = status('s', { content: '<p>edited</p>' });
    const after = replaceStatus(buffer, edited);
    const boost = statusAt(after, 0);

    expect(boost.content).toBe('<p>b</p>');
    expect(boost.reblog).toStrictEqual(edited);
    expect(after.lines[0]).not.toBe(buffer.lines[0]);
  });

  it('replaces every line showing the status and leaves the others alone', () => {
    const shown = status('s');
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [
        systemLine(0),
        postLine('s', shown),
        postLine('b', status('b', { reblog: shown })),
        postLine('x', status('x')),
      ],
    };

    const edited = status('s', { content: '<p>edited</p>' });
    const after = replaceStatus(buffer, edited);

    expect(statusAt(after, 1)).toBe(edited);
    expect(statusAt(after, 2).reblog).toStrictEqual(edited);
    expect(after.lines[0]).toBe(buffer.lines[0]);
    expect(after.lines[3]).toBe(buffer.lines[3]);
  });

  it('returns the same buffer when no line shows the status', () => {
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [systemLine(0), postLine('a', status('a'))],
    };

    expect(replaceStatus(buffer, status('gone'))).toBe(buffer);
    expect(replaceStatus(EMPTY_BUFFER, status('gone'))).toBe(EMPTY_BUFFER);
  });
});

describe(removeStatus, () => {
  it('drops the lines showing the status directly and through a boost', () => {
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [
        systemLine(0),
        postLine('s', status('s')),
        postLine('b', status('b', { reblog: status('s') })),
        postLine('c', status('c', { reblog: status('keep') })),
      ],
    };

    const after = removeStatus(buffer, 's');

    expect(keys(after)).toStrictEqual(['sys:0', 'post:c']);
    expect(buffer.lines).toHaveLength(4);
  });

  it('clears the selection when it stood on one of the removed lines', () => {
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [postLine('b', status('b', { reblog: status('s') }))],
      selectedKey: 'post:b',
    };

    const after = removeStatus(buffer, 's');

    expect(after.lines).toHaveLength(0);
    expect(after.selectedKey).toBeNull();
  });

  it('keeps a selection standing on a line that stays', () => {
    const buffer: Buffer = {
      ...EMPTY_BUFFER,
      lines: [postLine('gone', status('gone')), postLine('keep', status('keep'))],
      selectedKey: 'post:keep',
    };

    const after = removeStatus(buffer, 'gone');

    expect(statusAt(after, 0).id).toBe('keep');
    expect(after.selectedKey).toBe('post:keep');
  });

  it('returns the same buffer when no line shows the status', () => {
    const buffer: Buffer = { ...EMPTY_BUFFER, lines: [postLine('a', status('a'))] };

    expect(removeStatus(buffer, 'gone')).toBe(buffer);
    expect(removeStatus(EMPTY_BUFFER, 'gone')).toBe(EMPTY_BUFFER);
  });
});
