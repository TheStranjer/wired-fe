import { describe, expect, it } from 'vitest';

import { collectModules } from './registry';

/** A guard for the test: a string. */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

describe(collectModules, () => {
  it('returns an empty list for no modules', () => {
    expect(collectModules({}, isString, 'a string')).toStrictEqual({ ok: true, value: [] });
  });

  it('returns the pairs sorted by path', () => {
    const result = collectModules(
      { './b.ts': 'b', './a.ts': 'a', './c.ts': 'c' },
      isString,
      'a string',
    );

    expect(result).toStrictEqual({
      ok: true,
      value: [
        ['./a.ts', 'a'],
        ['./b.ts', 'b'],
        ['./c.ts', 'c'],
      ],
    });
  });

  it('names the first bad module in path order', () => {
    const result = collectModules(
      { './z.ts': 1, './a.ts': 'a', './m.ts': 2 },
      isString,
      'a string',
    );

    expect(result).toStrictEqual({ ok: false, error: './m.ts does not export a string' });
  });
});
