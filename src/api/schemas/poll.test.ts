/**
 * Tests for the Poll schema: the full Mastodon shape with unknown keys dropped,
 * the logged-out poll that arrives without any per-account fields, options
 * whose tallies a backend hides as null, and the inputs that fail outright —
 * a missing options array, a non-integer or negative total, a missing flag.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { Poll, PollOption } from './poll';
import { PollSchema } from './poll';

/** The two choices of the full Mastodon poll, input and expectation alike. */
const MASTODON_OPTIONS: readonly PollOption[] = [
  { title: 'Tabs', votes_count: 25 },
  { title: 'Spaces', votes_count: 17 },
];

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): Poll {
  const result = v.safeParse(PollSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('Poll schema', () => {
  it('passes a full Mastodon poll through, dropping unknown keys', () => {
    expect(
      parse({
        id: '109',
        expires_at: '2026-11-20T12:00:00.000Z',
        expired: false,
        multiple: false,
        votes_count: 42,
        voters_count: null,
        options: MASTODON_OPTIONS,
        voted: true,
        own_votes: [1],
        emojis: [
          {
            shortcode: 'blobcat',
            url: 'https://mastodon.example/emoji/blobcat.gif',
            static_url: 'https://mastodon.example/emoji/blobcat.png',
            visible_in_picker: true,
            category: 'Cats',
          },
        ],
        cached_web_tallies: true,
      }),
    ).toStrictEqual({
      id: '109',
      expires_at: '2026-11-20T12:00:00.000Z',
      expired: false,
      multiple: false,
      votes_count: 42,
      voters_count: null,
      options: MASTODON_OPTIONS,
      voted: true,
      own_votes: [1],
      emojis: [
        {
          shortcode: 'blobcat',
          url: 'https://mastodon.example/emoji/blobcat.gif',
          static_url: 'https://mastodon.example/emoji/blobcat.png',
          visible_in_picker: true,
          category: 'Cats',
        },
      ],
    });
  });

  it('applies logged-out defaults to a poll without voted or own_votes', () => {
    expect(
      parse({
        id: '1',
        expired: false,
        multiple: false,
        votes_count: 0,
        options: [{ title: 'Only option' }],
      }),
    ).toStrictEqual({
      id: '1',
      expires_at: null,
      expired: false,
      multiple: false,
      votes_count: 0,
      voters_count: null,
      options: [{ title: 'Only option', votes_count: null }],
      voted: false,
      own_votes: [],
      emojis: [],
    });
  });

  it('keeps explicit null dates and null option tallies for hidden totals', () => {
    expect(
      parse({
        id: '7',
        expires_at: null,
        expired: true,
        multiple: true,
        votes_count: 3,
        voters_count: 3,
        options: [
          { title: 'a', votes_count: null },
          { title: 'b', votes_count: 0 },
        ],
        voted: false,
        own_votes: [],
        emojis: [],
      }),
    ).toStrictEqual({
      id: '7',
      expires_at: null,
      expired: true,
      multiple: true,
      votes_count: 3,
      voters_count: 3,
      options: [
        { title: 'a', votes_count: null },
        { title: 'b', votes_count: 0 },
      ],
      voted: false,
      own_votes: [],
      emojis: [],
    });
  });

  it('normalizes a poll emoji through the CustomEmoji schema', () => {
    expect(
      parse({
        id: '8',
        expired: false,
        multiple: false,
        votes_count: 1,
        options: [{ title: 'yes', votes_count: 1 }],
        voted: false,
        own_votes: [],
        emojis: [
          { shortcode: 'lain', url: 'https://wired.example/emoji/lain.png', static_url: null },
        ],
      }),
    ).toMatchObject({
      emojis: [
        {
          shortcode: 'lain',
          url: 'https://wired.example/emoji/lain.png',
          static_url: 'https://wired.example/emoji/lain.png',
          visible_in_picker: true,
          category: null,
        },
      ],
    });
  });

  it('fails when options is missing', () => {
    expect(
      v.safeParse(PollSchema, { id: '1', expired: false, multiple: false, votes_count: 0 }).success,
    ).toBe(false);
  });

  it('fails on a negative or fractional votes_count', () => {
    const options = [{ title: 'a' }];

    expect(
      v.safeParse(PollSchema, {
        id: '1',
        expired: false,
        multiple: false,
        votes_count: -1,
        options,
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(PollSchema, {
        id: '1',
        expired: false,
        multiple: false,
        votes_count: 1.5,
        options,
      }).success,
    ).toBe(false);
  });

  it('fails when a required flag is missing or an option has no title', () => {
    expect(
      v.safeParse(PollSchema, { id: '1', multiple: false, votes_count: 0, options: [] }).success,
    ).toBe(false);
    expect(
      v.safeParse(PollSchema, {
        id: '1',
        expired: false,
        multiple: false,
        votes_count: 0,
        options: [{ votes_count: 0 }],
      }).success,
    ).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(PollSchema, 'poll').success).toBe(false);
  });
});
