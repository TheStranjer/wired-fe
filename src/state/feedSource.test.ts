/**
 * Tests for parseSource, the feed-source command grammar: each form it reads
 * (one account, `*`, a tag), case and `@` handling of handles, and the ways it
 * refuses — unknown accounts, `*` with nobody signed in, malformed sources.
 */

import { describe, expect, it } from 'vitest';

import type { FeedSourceRef } from './feeds';
import { parseSource } from './feedSource';

const LAIN_HOME: FeedSourceRef = { accountKey: 'https://a.example#1', source: 'home' };
const LAIN_RUST: FeedSourceRef = { accountKey: 'https://a.example#1', source: 'tag:rust' };

const ACCOUNTS = [
  { key: 'https://a.example#1', handle: 'me@a.example' },
  { key: 'https://b.example#2', handle: 'alice@b.example' },
];

/** The value of an Ok, failing the test on an Err. */
function valueOf<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

/** The error of an Err, failing the test on an Ok. */
function errorOf(result: { ok: true } | { ok: false; error: string }): string {
  if (result.ok) {
    throw new Error('expected an error');
  }
  return result.error;
}

describe(parseSource, () => {
  it('reads one account’s plain source', () => {
    expect(valueOf(parseSource('@me@a.example:home', ACCOUNTS))).toStrictEqual([LAIN_HOME]);
  });

  it('matches the handle with or without the @, ignoring case', () => {
    expect(valueOf(parseSource('ME@a.example:home', ACCOUNTS))).toStrictEqual([LAIN_HOME]);
  });

  it('reads a tag source', () => {
    expect(valueOf(parseSource('@me@a.example:tag:rust', ACCOUNTS))).toStrictEqual([LAIN_RUST]);
  });

  it('expands * to every signed-in account', () => {
    expect(valueOf(parseSource('*:mentions', ACCOUNTS))).toStrictEqual([
      { accountKey: 'https://a.example#1', source: 'mentions' },
      { accountKey: 'https://b.example#2', source: 'mentions' },
    ]);
  });

  it('refuses * when nobody is signed in', () => {
    expect(errorOf(parseSource('*:home', []))).toContain('No account');
  });

  it('refuses an account that is not signed in', () => {
    expect(errorOf(parseSource('@ghost@c.example:home', ACCOUNTS))).toContain('@ghost@c.example');
  });

  it.each(['home', ':home', '*:', '*:trending', '*:tag:', '*:tag:#rust', '*:tag:a b'])(
    'refuses %j as a source',
    (text) => {
      expect(errorOf(parseSource(text, ACCOUNTS))).toContain('Not a source');
    },
  );
});
