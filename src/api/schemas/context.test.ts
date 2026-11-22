/**
 * Tests for the Context schema: a thread with one ancestor and two
 * descendants, the empty context of a root post with no replies, the arrays
 * a backend must always send, and the responses that are not a context at all.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { Context } from './context';
import { ContextSchema } from './context';
import type { Status } from './status';
import { StatusSchema } from './status';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): Context {
  const result = v.safeParse(ContextSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** The twelve fields every backend sends for an account. */
const ACCOUNT = {
  id: '1',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain Iwakura',
  created_at: '1998-07-06T00:00:00.000Z',
  note: '<p>Close the world. Open the nExt.</p>',
  url: 'https://wired.example/users/lain',
  avatar: 'https://wired.example/avatars/lain.png',
  header: 'https://wired.example/headers/lain.jpg',
  followers_count: 42,
  following_count: 17,
  statuses_count: 256,
};

/** The nine required fields of a status, as the wire carries them. */
function wireStatus(id: string): Record<string, unknown> {
  return {
    id,
    uri: `https://wired.example/posts/${id}`,
    created_at: '2026-11-12T21:14:05.000Z',
    account: ACCOUNT,
    content: `<p>post ${id}</p>`,
    visibility: 'public',
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
  };
}

/** What the Status schema makes of {@link wireStatus}: every default applied. */
function parsedStatus(id: string): Status {
  const result = v.safeParse(StatusSchema, wireStatus(id));
  if (!result.success) {
    throw new Error(`broken test fixture: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** Inputs that must not parse at all: arrays missing, or of the wrong shape. */
const BAD_CONTEXTS: readonly (readonly [string, unknown])[] = [
  ['non-object input', 'lain'],
  ['a non-array ancestors', { ancestors: 'lain', descendants: [] }],
  ['a non-array descendants', { ancestors: [], descendants: { id: '1' } }],
  ['a numeric array', { ancestors: 3, descendants: [] }],
];

describe('Context schema', () => {
  it('parses one ancestor and two descendants', () => {
    expect(
      parse({
        ancestors: [wireStatus('1')],
        descendants: [wireStatus('2'), wireStatus('3')],
      }),
    ).toStrictEqual({
      ancestors: [parsedStatus('1')],
      descendants: [parsedStatus('2'), parsedStatus('3')],
    });
  });

  it('accepts the empty arrays of a root post without replies', () => {
    expect(parse({ ancestors: [], descendants: [] })).toStrictEqual({
      ancestors: [],
      descendants: [],
    });
  });

  it('drops keys the context endpoint does not model', () => {
    const output = parse({ ancestors: [], descendants: [], other: 'value' });

    expect(new Set(Object.keys(output))).toStrictEqual(new Set(['ancestors', 'descendants']));
  });

  it('drops a bad descendant and keeps the ancestors intact', () => {
    expect(
      parse({
        ancestors: [wireStatus('1')],
        descendants: [wireStatus('2'), { ...wireStatus('3'), replies_count: -1 }, wireStatus('4')],
      }),
    ).toStrictEqual({
      ancestors: [parsedStatus('1')],
      descendants: [parsedStatus('2'), parsedStatus('4')],
    });
  });

  it('fails without descendants', () => {
    expect(v.safeParse(ContextSchema, { ancestors: [] }).success).toBe(false);
  });

  it('fails without ancestors', () => {
    expect(v.safeParse(ContextSchema, { descendants: [] }).success).toBe(false);
  });

  it.each(BAD_CONTEXTS)('fails on %s', (_name, wire) => {
    expect(v.safeParse(ContextSchema, wire).success).toBe(false);
  });
});
