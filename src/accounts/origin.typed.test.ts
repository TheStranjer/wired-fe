/**
 * Tests for which builds let the user's input pick the instance (WFE-343):
 * `open`, and `list` with `allowCustom` for an unlisted origin.
 */
import { describe, expect, it } from 'vitest';

import { isTypedInstance } from './origin';

const WIRED = 'https://wired.example';
const OTHER = 'https://other.example';

describe(isTypedInstance, () => {
  it('is true for every origin of an open build', () => {
    expect(isTypedInstance({ mode: 'open' }, WIRED)).toBe(true);
  });

  it('is true for an unlisted origin of a list that allows custom ones', () => {
    expect(isTypedInstance({ mode: 'list', origins: [WIRED], allowCustom: true }, OTHER)).toBe(
      true,
    );
  });

  it('is false for a listed origin, or when the list is closed', () => {
    expect(isTypedInstance({ mode: 'list', origins: [WIRED], allowCustom: true }, WIRED)).toBe(
      false,
    );
    expect(isTypedInstance({ mode: 'list', origins: [WIRED] }, OTHER)).toBe(false);
  });

  it('is false for builds that ignore the input', () => {
    expect(isTypedInstance({ mode: 'same-origin' }, WIRED)).toBe(false);
    expect(isTypedInstance({ mode: 'fixed', origin: WIRED }, OTHER)).toBe(false);
  });
});
