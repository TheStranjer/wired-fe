/**
 * Tests for formatDuration: the largest unit a span reaches names it, whole,
 * floored; seconds stand alone below a minute.
 */
import { describe, expect, it } from 'vitest';

import { formatDuration } from './duration';

describe(formatDuration, () => {
  it.each([
    [86_400, '1d'],
    [262_974, '3d'],
    [31_536_000, '365d'],
    [3_600, '1h'],
    [7_200, '2h'],
    [60, '1m'],
    [300, '5m'],
  ])('counts %i as %s, the largest unit it reaches', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('floors to the whole unit', () => {
    expect(formatDuration(86_399)).toBe('23h');
    expect(formatDuration(3_599)).toBe('59m');
    expect(formatDuration(90)).toBe('1m');
  });

  it('counts anything shorter than a minute in seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59)).toBe('59s');
  });
});
