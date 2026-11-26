/**
 * Tests for what a visitor may pick from on each build (WFE-307): only a
 * `list` with origins offers choices, and a lone origin is preselected.
 */
import { describe, expect, it } from 'vitest';

import { instanceChoices, preselectedOrigin } from './origin';

const WIRED = 'https://wired.example';
const PLEROMA = 'https://pleroma.example';

describe(instanceChoices, () => {
  it('offers the listed origins of a closed list', () => {
    expect(instanceChoices({ mode: 'list', origins: [WIRED, PLEROMA] })).toStrictEqual({
      origins: [WIRED, PLEROMA],
      allowCustom: false,
    });
  });

  it('says so when the list also allows custom instances', () => {
    expect(instanceChoices({ mode: 'list', origins: [WIRED], allowCustom: true })).toStrictEqual({
      origins: [WIRED],
      allowCustom: true,
    });
  });

  it('offers nothing for an empty list, an open build or a build that knows its instance', () => {
    expect(instanceChoices({ mode: 'list', origins: [], allowCustom: true })).toBeNull();
    expect(instanceChoices({ mode: 'open' })).toBeNull();
    expect(instanceChoices({ mode: 'same-origin' })).toBeNull();
    expect(instanceChoices({ mode: 'fixed', origin: WIRED })).toBeNull();
  });
});

describe(preselectedOrigin, () => {
  it('is the only origin on offer', () => {
    expect(preselectedOrigin({ origins: [WIRED], allowCustom: false })).toBe(WIRED);
  });

  it('is empty with several origins, none, or no choices at all', () => {
    expect(preselectedOrigin({ origins: [WIRED, PLEROMA], allowCustom: false })).toBe('');
    expect(preselectedOrigin({ origins: [], allowCustom: true })).toBe('');
    expect(preselectedOrigin(null)).toBe('');
    expect(preselectedOrigin(undefined)).toBe('');
  });
});
