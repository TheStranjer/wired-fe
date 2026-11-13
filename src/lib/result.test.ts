import { describe, expect, it } from 'vitest';

import { err, ok } from './result';
import type { Err, Ok, Result } from './result';

/** Narrows a Result through its `ok` tag, the way every caller must. */
function unwrap(r: Result<number, string>): string {
  if (r.ok) {
    return `value:${String(r.value)}`;
  }
  return `error:${r.error}`;
}

describe(ok, () => {
  it('wraps a value as the success variant', () => {
    const result: Ok<number> = ok(7);

    expect(result).toStrictEqual({ ok: true, value: 7 });
  });
});

describe(err, () => {
  it('wraps an error as the failure variant', () => {
    const result: Err<string> = err('not found');

    expect(result).toStrictEqual({ ok: false, error: 'not found' });
  });
});

describe('Result', () => {
  it('narrows to value in the ok branch and error in the err branch', () => {
    const good: Result<number, string> = ok(1);
    const bad: Result<number, string> = err('boom');

    expect(unwrap(good)).toBe('value:1');
    expect(unwrap(bad)).toBe('error:boom');
  });
});
