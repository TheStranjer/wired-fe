/**
 * Tests for the key-binding mode word: the two modes name themselves and
 * nothing else does — not another case, not a half-word, not a missing word.
 */
import { describe, expect, it } from 'vitest';

import { modeOf } from './bindingArgs';

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
