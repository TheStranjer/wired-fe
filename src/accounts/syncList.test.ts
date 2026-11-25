/**
 * Tests for the pure edits of the ordered sync list: promoting a key to
 * primary, dropping one, and moving one a place up.
 */
import { describe, expect, it } from 'vitest';

import { movedUp, withPrimary, withoutKey } from './syncList';

describe(withPrimary, () => {
  it('puts a new key first', () => {
    expect(withPrimary(['a', 'b'], 'c')).toStrictEqual(['c', 'a', 'b']);
  });

  it('moves a listed key to the front without duplicating it', () => {
    expect(withPrimary(['a', 'b', 'c'], 'c')).toStrictEqual(['c', 'a', 'b']);
  });
});

describe(withoutKey, () => {
  it('drops the key and keeps the order of the rest', () => {
    expect(withoutKey(['a', 'b', 'c'], 'b')).toStrictEqual(['a', 'c']);
  });
});

describe(movedUp, () => {
  it('swaps a key with the one before it', () => {
    expect(movedUp(['a', 'b', 'c'], 'c')).toStrictEqual(['a', 'c', 'b']);
  });

  it('leaves the first key and an unlisted key where they are', () => {
    expect(movedUp(['a', 'b'], 'a')).toStrictEqual(['a', 'b']);
    expect(movedUp(['a', 'b'], 'z')).toStrictEqual(['a', 'b']);
  });
});
