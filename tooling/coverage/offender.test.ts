/** Tests for how offenders are ordered and printed. */
import { describe, expect, it } from 'vitest';

import { compareOffenders, formatOffender } from './offender';

describe(formatOffender, () => {
  it('prints path:line and the message', () => {
    expect(formatOffender({ file: 'src/x.ts', line: 42, message: 'statement not run' })).toBe(
      'src/x.ts:42 statement not run',
    );
  });
});

describe(compareOffenders, () => {
  const base = { file: 'src/b.ts', line: 5, message: 'm' };

  it.each([
    [{ ...base, file: 'src/a.ts' }, 1],
    [{ ...base, file: 'src/c.ts' }, -1],
    [{ ...base, line: 4 }, 1],
    [{ ...base, line: 9 }, -4],
    [{ ...base, message: 'a' }, 1],
    [{ ...base, message: 'z' }, -1],
    [{ ...base }, 0],
  ])('orders %j against the base as %i in sign', (other, sign) => {
    expect(Math.sign(compareOffenders(base, other))).toBe(Math.sign(sign));
  });
});
