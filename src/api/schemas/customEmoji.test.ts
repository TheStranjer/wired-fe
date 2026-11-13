/**
 * Tests for the CustomEmoji schema: pass-through of the full shape, and the
 * defaults and normalization (static_url fallback, dropped unknown keys) the
 * three backends' renderings need.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { CustomEmojiSchema } from './customEmoji';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): unknown {
  const result = v.safeParse(CustomEmojiSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('CustomEmoji schema', () => {
  it('passes a full Mastodon emoji through, dropping unknown keys', () => {
    expect(
      parse({
        shortcode: 'blobcat',
        url: 'https://mastodon.example/emoji/blobcat.gif',
        static_url: 'https://mastodon.example/emoji/blobcat.png',
        visible_in_picker: true,
        category: 'Cats',
        custom: true,
      }),
    ).toStrictEqual({
      shortcode: 'blobcat',
      url: 'https://mastodon.example/emoji/blobcat.gif',
      static_url: 'https://mastodon.example/emoji/blobcat.png',
      visible_in_picker: true,
      category: 'Cats',
    });
  });

  it('uses url for a Wired emoji whose static_url is null and drops its tags', () => {
    const output = parse({
      shortcode: 'lain',
      url: 'https://wired.example/emoji/lain.png',
      static_url: null,
      visible_in_picker: true,
      category: null,
      tags: [],
    });

    expect(output).toStrictEqual({
      shortcode: 'lain',
      url: 'https://wired.example/emoji/lain.png',
      static_url: 'https://wired.example/emoji/lain.png',
      visible_in_picker: true,
      category: null,
    });
  });

  it('applies defaults to a minimal shortcode-and-url emoji', () => {
    expect(
      parse({ shortcode: 'party', url: 'https://wired.example/emoji/party.gif' }),
    ).toStrictEqual({
      shortcode: 'party',
      url: 'https://wired.example/emoji/party.gif',
      static_url: 'https://wired.example/emoji/party.gif',
      visible_in_picker: true,
      category: null,
    });
  });

  it('keeps a false visible_in_picker and a null category', () => {
    expect(
      parse({
        shortcode: 'secret',
        url: 'https://wired.example/emoji/secret.png',
        visible_in_picker: false,
        category: null,
      }),
    ).toStrictEqual({
      shortcode: 'secret',
      url: 'https://wired.example/emoji/secret.png',
      static_url: 'https://wired.example/emoji/secret.png',
      visible_in_picker: false,
      category: null,
    });
  });

  it('fails when url is missing', () => {
    expect(v.safeParse(CustomEmojiSchema, { shortcode: 'broken' }).success).toBe(false);
  });

  it('fails when shortcode is missing', () => {
    expect(v.safeParse(CustomEmojiSchema, { url: 'https://wired.example/e.png' }).success).toBe(
      false,
    );
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(CustomEmojiSchema, 'blobcat').success).toBe(false);
  });
});
