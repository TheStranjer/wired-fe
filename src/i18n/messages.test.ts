/** Tests for flattening a nested catalog into dot paths. */
import { describe, expect, it } from 'vitest';

import { flatten, literals } from './messages';

describe(literals, () => {
  it('maps each word to itself', () => {
    expect(literals('now', 'off')).toStrictEqual({ now: 'now', off: 'off' });
  });

  it('is empty for no words', () => {
    expect(literals()).toStrictEqual({});
  });
});

describe(flatten, () => {
  it('turns nested objects into dot paths', () => {
    const flat = flatten({ a: { b: 'x', c: { d: 'y' } }, e: 'z' });

    expect([...flat]).toStrictEqual([
      ['a.b', 'x'],
      ['a.c.d', 'y'],
      ['e', 'z'],
    ]);
  });

  it('drops what is not a message or an object of messages', () => {
    expect([...flatten({ a: 1, b: null, c: ['x'], d: { e: true, f: 'ok' } })]).toStrictEqual([
      ['d.f', 'ok'],
    ]);
  });

  it('answers nothing for a catalog that is not an object', () => {
    expect(flatten('text').size).toBe(0);
    expect(flatten(null).size).toBe(0);
  });
});
