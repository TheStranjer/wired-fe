/**
 * Tests for the emoji provider: `:shortcode:` words complete from a custom
 * emoji list, wrapped in colons, matched without case and sorted — and a bare
 * colon offers nothing. See ./completionProviders.test.ts for the handles and
 * ./completionProviders.tags.test.ts for the tags.
 */
import { describe, expect, it } from 'vitest';

import { emojiProvider } from './completionProviders';
import type { CustomEmoji } from '../api/schemas/customEmoji';

/** Three shortcodes, one of them spelled with a capital. */
const EMOJIS: readonly CustomEmoji[] = [
  {
    shortcode: 'lain',
    url: 'https://wired.example/e/lain.png',
    static_url: 'https://wired.example/e/lain.png',
    visible_in_picker: true,
    category: null,
  },
  {
    shortcode: 'lob',
    url: 'https://wired.example/e/lob.gif',
    static_url: 'https://wired.example/e/lob.gif',
    visible_in_picker: true,
    category: null,
  },
  {
    shortcode: 'Alice',
    url: 'https://wired.example/e/alice.png',
    static_url: 'https://wired.example/e/alice.png',
    visible_in_picker: true,
    category: null,
  },
];

describe(emojiProvider, () => {
  it('accepts colon words only with at least one more character', () => {
    const provider = emojiProvider(EMOJIS);

    expect(provider.accepts(':l', false)).toBe(true);
    expect(provider.accepts(':lain:', false)).toBe(true);
    expect(provider.accepts(':', false)).toBe(false);
    expect(provider.accepts('@la', false)).toBe(false);
  });

  it('wraps shortcodes in colons, matches without case and sorts', () => {
    const provider = emojiProvider(EMOJIS);

    expect(provider.candidates(':l')).toStrictEqual([':lain:', ':lob:']);
    expect(provider.candidates(':A')).toStrictEqual([':Alice:']);
    expect(provider.candidates(':zz')).toStrictEqual([]);
  });

  it('deduplicates repeated shortcodes and offers nothing without a list', () => {
    expect(emojiProvider([...EMOJIS, ...EMOJIS]).candidates(':la')).toStrictEqual([':lain:']);
    expect(emojiProvider([]).candidates(':lain')).toStrictEqual([]);
  });
});
