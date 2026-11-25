/**
 * Tests for the key-binding mode word: the two modes name themselves and
 * nothing else does — not another case, not a half-word, not a missing word.
 */
import { describe, expect, it } from 'vitest';

import { modeOf, splitBinding } from './bindingArgs';

describe(modeOf, () => {
  it('reads the two mode words as themselves', () => {
    expect(modeOf('insert')).toBe('insert');
    expect(modeOf('navigation')).toBe('navigation');
  });

  it.each(['Insert', 'both', 'nav', ''])('refuses the word %s', (word) => {
    expect(modeOf(word)).toBeNull();
  });

  it('refuses a word that is not there', () => {
    expect(modeOf(undefined)).toBeNull();
  });
});

describe(splitBinding, () => {
  it('takes one chord and the line behind it', () => {
    expect(splitBinding(['ctrl+e', '/fav', 'a3'])).toStrictEqual({
      chords: 'ctrl+e',
      line: '/fav a3',
    });
  });

  it('takes every word before the first slash word as the sequence', () => {
    expect(splitBinding(['w', 'v', '/vsplit', 'feed', 'main'])).toStrictEqual({
      chords: 'w v',
      line: '/vsplit feed main',
    });
  });

  it('always takes the first word as a chord, even a slash', () => {
    expect(splitBinding(['/', '/help'])).toStrictEqual({ chords: '/', line: '/help' });
  });

  it('leaves the words after the first chord as the line when none starts with a slash', () => {
    expect(splitBinding(['ctrl+e', 'help', 'me'])).toStrictEqual({
      chords: 'ctrl+e',
      line: 'help me',
    });
  });

  it('yields nothing for no words', () => {
    expect(splitBinding([])).toStrictEqual({ chords: '', line: '' });
  });
});
