import { describe, expect, it } from 'vitest';

import { isPlainClick } from './plainClick';

const PLAIN = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };

describe(isPlainClick, () => {
  it('accepts a primary click with no modifiers', () => {
    expect(isPlainClick(PLAIN)).toBe(true);
  });

  it('refuses the middle button', () => {
    expect(isPlainClick({ ...PLAIN, button: 1 })).toBe(false);
  });

  it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const)('refuses %s held', (key) => {
    expect(isPlainClick({ ...PLAIN, [key]: true })).toBe(false);
  });
});
