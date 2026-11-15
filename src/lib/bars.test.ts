/**
 * Tests for the ASCII bar: the empty bar at zero share, the full bar at one,
 * the even split, rounding to the nearest cell with halves up, and the
 * clamping of shares outside [0,1].
 */
import { describe, expect, it } from 'vitest';

import { bar } from './bars';

describe(bar, () => {
  it('is all empty cells at zero share', () => {
    expect(bar(0, 5)).toBe('░░░░░');
  });

  it('is all filled cells at a full share', () => {
    expect(bar(1, 5)).toBe('█████');
  });

  it('fills exactly half an even width at a half share', () => {
    expect(bar(0.5, 4)).toBe('██░░');
  });

  it('rounds a half cell up on an odd width', () => {
    expect(bar(0.5, 5)).toBe('███░░');
  });

  it('rounds down to the nearest cell', () => {
    expect(bar(0.52, 10)).toBe('█████░░░░░');
  });

  it('rounds up to the nearest cell', () => {
    expect(bar(0.55, 10)).toBe('██████░░░░');
  });

  it('clamps a share above one to a full bar', () => {
    expect(bar(1.4, 3)).toBe('███');
  });

  it('clamps a negative share to an empty bar', () => {
    expect(bar(-0.2, 3)).toBe('░░░');
  });

  it('is the ticket example: a 20-cell bar of a 30 percent share', () => {
    expect(bar(0.3, 20)).toBe('██████░░░░░░░░░░░░░░');
    expect(bar(0.7, 20)).toBe('██████████████░░░░░░');
  });
});
