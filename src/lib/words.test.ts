/**
 * Tests for the shared argument-word split: the words wherever the whitespace
 * is, and no words at all for blank text.
 */
import { describe, expect, it } from 'vitest';

import { wordsOf } from './words';

describe(wordsOf, () => {
  it('splits the words wherever the whitespace is', () => {
    expect(wordsOf('  navigation   ctrl+e  /fav  ')).toStrictEqual([
      'navigation',
      'ctrl+e',
      '/fav',
    ]);
  });

  it('spells no words for blank text', () => {
    expect(wordsOf('')).toStrictEqual([]);
    expect(wordsOf('   \t ')).toStrictEqual([]);
  });

  it('keeps a quoted-looking word whole', () => {
    expect(wordsOf('one "two three" four')).toStrictEqual(['one', '"two', 'three"', 'four']);
  });
});
