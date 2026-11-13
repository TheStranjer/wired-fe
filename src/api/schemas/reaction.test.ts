/**
 * Tests for the Reaction schema: required fields, the `me` and `url`
 * defaults, dropping the reactor-list keys, and rejecting a negative or
 * non-integer count.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { ReactionSchema } from './reaction';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): unknown {
  const result = v.safeParse(ReactionSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('Reaction schema', () => {
  it('passes a full reaction through, dropping account_ids and accounts', () => {
    expect(
      parse({
        name: '🔥',
        count: 2,
        me: true,
        url: 'https://wired.example/emoji/fire.png',
        account_ids: ['1', '4'],
        accounts: [{ id: '1' }],
      }),
    ).toStrictEqual({
      name: '🔥',
      count: 2,
      me: true,
      url: 'https://wired.example/emoji/fire.png',
    });
  });

  it('applies defaults to a minimal name-and-count reaction', () => {
    expect(parse({ name: '❤️', count: 0 })).toStrictEqual({
      name: '❤️',
      count: 0,
      me: false,
      url: null,
    });
  });

  it('keeps a null url', () => {
    expect(parse({ name: ':lain:', count: 1, url: null })).toStrictEqual({
      name: ':lain:',
      count: 1,
      me: false,
      url: null,
    });
  });

  it('fails on a negative count', () => {
    expect(v.safeParse(ReactionSchema, { name: '🔥', count: -1 }).success).toBe(false);
  });

  it('fails on a non-integer count', () => {
    expect(v.safeParse(ReactionSchema, { name: '🔥', count: 1.5 }).success).toBe(false);
  });

  it('fails when name is missing', () => {
    expect(v.safeParse(ReactionSchema, { count: 1 }).success).toBe(false);
  });

  it('fails when count is missing', () => {
    expect(v.safeParse(ReactionSchema, { name: '🔥' }).success).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(ReactionSchema, '🔥').success).toBe(false);
  });
});
