/**
 * Tests for replacing one field of a state: a new value gives a new state with
 * only that field changed, and the value it already holds gives the very same
 * state back.
 */
import { describe, expect, it } from 'vitest';

import { replacing } from './appReducer';

describe(replacing, () => {
  it('puts the new value under the key and leaves the rest alone', () => {
    const state = { name: 'lain', age: 14 };

    expect(replacing(state, 'age', 15)).toStrictEqual({ name: 'lain', age: 15 });
  });

  it('is the same state when the key already holds the value', () => {
    const state = { name: 'lain', age: 14 };

    expect(replacing(state, 'age', 14)).toBe(state);
  });
});
