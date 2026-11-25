/**
 * Tests for withoutReactionWords (WFE-172): custom emoji do not complete on a
 * `/react` or `/unreact` line, and still complete everywhere else.
 */
import { describe, expect, it } from 'vitest';

import { emojiProvider } from './completionProviders';
import { withoutReactionWords } from './reactionProviders';
import type { CustomEmoji } from '../api/schemas/customEmoji';

const LAIN: CustomEmoji = {
  shortcode: 'lain',
  url: 'https://wired.example/e/lain.png',
  static_url: 'https://wired.example/e/lain.png',
  visible_in_picker: true,
  category: null,
};

describe(withoutReactionWords, () => {
  const provider = withoutReactionWords(emojiProvider([LAIN]));

  it('stands aside on a react or unreact line', () => {
    expect(provider.accepts(':la', false, '/react a1 :la')).toBe(false);
    expect(provider.accepts(':la', false, '/UNREACT a1 :la')).toBe(false);
  });

  it('completes in a post and on other commands', () => {
    expect(provider.accepts(':la', false, 'hello :la')).toBe(true);
    expect(provider.accepts(':la', false, '/reactions :la')).toBe(true);
    expect(provider.accepts(':la', false)).toBe(true);
    expect(provider.candidates(':la')).toStrictEqual([':lain:']);
  });

  it('still wants a character after the colon', () => {
    expect(provider.accepts(':', false, 'hello :')).toBe(false);
  });
});
