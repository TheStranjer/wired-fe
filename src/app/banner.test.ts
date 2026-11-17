/**
 * Tests for the startup banner: the art is five to seven lines of at most
 * sixty columns, drawn only in block characters and spaces, so the status
 * window can open with it (WFE-135). src/app/startup.test.ts asserts that
 * every line is printed decorative and that the text alternative follows.
 */
import { describe, expect, it } from 'vitest';

import { BANNER } from './banner';

/** A line drawn with nothing but the block characters and spaces. */
const BLOCK_ART = /^[█▀▄░▒▓ ]+$/u;

describe('the banner art', () => {
  it('runs five to seven lines', () => {
    expect(BANNER.length).toBeGreaterThanOrEqual(5);
    expect(BANNER.length).toBeLessThanOrEqual(7);
  });

  it('keeps every line at most 60 characters wide', () => {
    for (const line of BANNER) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  it('draws every line in nothing but block characters and spaces', () => {
    for (const line of BANNER) {
      expect(line).toMatch(BLOCK_ART);
      expect(line.trim()).not.toBe('');
    }
  });
});
