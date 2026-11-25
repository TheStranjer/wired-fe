/**
 * Tests for the key-sorted JSON text: key order never matters, however deep,
 * while array order and scalars are kept.
 */
import { describe, expect, it } from 'vitest';

import { stableJson } from './stableJson';

describe(stableJson, () => {
  it('writes the same text whatever order the keys were added in', () => {
    const a = { b: 1, a: { d: [1, 2], c: null }, e: 'x' };
    const b = { e: 'x', a: { c: null, d: [1, 2] }, b: 1 };

    expect(stableJson(a)).toBe(stableJson(b));
    expect(stableJson(a)).toBe('{"a":{"c":null,"d":[1,2]},"b":1,"e":"x"}');
  });

  it('keeps the order of an array and tells different values apart', () => {
    expect(stableJson([{ b: 1, a: 2 }, 'z', 3])).toBe('[{"a":2,"b":1},"z",3]');
    expect(stableJson({ a: [1, 2] })).not.toBe(stableJson({ a: [2, 1] }));
  });

  it('writes a scalar as JSON does', () => {
    expect(stableJson('lain')).toBe('"lain"');
  });
});
