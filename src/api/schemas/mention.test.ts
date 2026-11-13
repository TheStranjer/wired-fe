/**
 * Tests for the Mention schema: pass-through of a full mention, the keys a
 * backend adds beyond the four fields, and the required-string failures.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { MentionSchema } from './mention';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): unknown {
  const result = v.safeParse(MentionSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('Mention schema', () => {
  it('passes a full Wired mention through unchanged', () => {
    expect(
      parse({
        id: '9',
        username: 'lain',
        acct: 'lain@wired.example',
        url: 'https://wired.example/users/lain',
      }),
    ).toStrictEqual({
      id: '9',
      username: 'lain',
      acct: 'lain@wired.example',
      url: 'https://wired.example/users/lain',
    });
  });

  it('drops keys a backend adds beyond the four fields', () => {
    expect(
      parse({
        id: '41',
        username: 'noriko',
        acct: 'noriko@pleroma.example',
        url: 'https://pleroma.example/users/noriko',
        displaying_name: 'Noriko',
      }),
    ).toStrictEqual({
      id: '41',
      username: 'noriko',
      acct: 'noriko@pleroma.example',
      url: 'https://pleroma.example/users/noriko',
    });
  });

  it('keeps a bare acct when the mention is local', () => {
    expect(
      parse({ id: '2', username: 'lain', acct: 'lain', url: 'https://wired.example/users/lain' }),
    ).toStrictEqual({
      id: '2',
      username: 'lain',
      acct: 'lain',
      url: 'https://wired.example/users/lain',
    });
  });

  it('fails when acct is missing', () => {
    expect(
      v.safeParse(MentionSchema, {
        id: '9',
        username: 'lain',
        url: 'https://wired.example/users/lain',
      }).success,
    ).toBe(false);
  });

  it('fails when id is missing', () => {
    expect(
      v.safeParse(MentionSchema, {
        username: 'lain',
        acct: 'lain@wired.example',
        url: 'https://wired.example/users/lain',
      }).success,
    ).toBe(false);
  });

  it('fails when a field is not a string', () => {
    expect(
      v.safeParse(MentionSchema, {
        id: '9',
        username: 'lain',
        acct: 12,
        url: 'https://wired.example/users/lain',
      }).success,
    ).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(MentionSchema, 'lain@wired.example').success).toBe(false);
  });
});
