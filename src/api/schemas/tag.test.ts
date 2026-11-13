/**
 * Tests for the Tag schema: the two fields a hashtag has, and the `history`
 * and other trending-endpoint keys that must not reach the internal model.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { TagSchema } from './tag';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): unknown {
  const result = v.safeParse(TagSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('Tag schema', () => {
  it('drops the history a trending tag carries', () => {
    expect(
      parse({
        name: 'Twizaint',
        url: 'https://wired.example/tags/twizaint',
        history: [
          { day: '1762704000', uses: '3', accounts: '2' },
          { day: '1762617600', uses: '11', accounts: '5' },
        ],
        following: false,
      }),
    ).toStrictEqual({
      name: 'Twizaint',
      url: 'https://wired.example/tags/twizaint',
    });
  });

  it('passes a tag with only its name and url through', () => {
    expect(parse({ name: 'lain', url: 'https://wired.example/tags/lain' })).toStrictEqual({
      name: 'lain',
      url: 'https://wired.example/tags/lain',
    });
  });

  it('fails when url is missing', () => {
    expect(v.safeParse(TagSchema, { name: 'lain' }).success).toBe(false);
  });

  it('fails when name is missing', () => {
    expect(v.safeParse(TagSchema, { url: 'https://wired.example/tags/lain' }).success).toBe(false);
  });

  it('fails when name is not a string', () => {
    expect(
      v.safeParse(TagSchema, { name: ['lain'], url: 'https://wired.example/tags/lain' }).success,
    ).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(TagSchema, '#lain').success).toBe(false);
  });
});
