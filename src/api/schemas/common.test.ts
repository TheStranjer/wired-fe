import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { CountSchema, stringList } from './common';

describe('the counter schema', () => {
  it('accepts whole non-negative numbers', () => {
    expect(v.safeParse(CountSchema, 0).success).toBe(true);
    expect(v.safeParse(CountSchema, 12).success).toBe(true);
  });

  it('rejects negatives, fractions and non-numbers', () => {
    expect(v.safeParse(CountSchema, -1).success).toBe(false);
    expect(v.safeParse(CountSchema, 1.5).success).toBe(false);
    expect(v.safeParse(CountSchema, '3').success).toBe(false);
  });
});

describe(stringList, () => {
  it('keeps the strings of an array and drops the rest', () => {
    expect(stringList(['a', 1, null, 'b'])).toStrictEqual(['a', 'b']);
  });

  it('yields [] for a non-array', () => {
    expect(stringList(undefined)).toStrictEqual([]);
    expect(stringList({ 0: 'a' })).toStrictEqual([]);
  });
});
