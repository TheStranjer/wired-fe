import { describe, expect, it } from 'vitest';

import { formatClock } from './time';

// Local-time constructor arguments, so the tests never depend on the
// machine's time zone.
describe(formatClock, () => {
  it('zero-pads hours and minutes in 24h format', () => {
    expect(formatClock(new Date(2026, 0, 2, 3, 4), '24h')).toBe('03:04');
  });

  it('shows midnight as 00:00 in 24h format', () => {
    expect(formatClock(new Date(2026, 0, 1, 0, 0), '24h')).toBe('00:00');
  });

  it('shows the last minute of the day as 23:59 in 24h format', () => {
    expect(formatClock(new Date(2026, 0, 2, 23, 59), '24h')).toBe('23:59');
  });

  it('shows midnight as 12:00am in 12h format', () => {
    expect(formatClock(new Date(2026, 0, 1, 0, 0), '12h')).toBe('12:00am');
  });

  it('shows noon as 12:00pm in 12h format', () => {
    expect(formatClock(new Date(2026, 0, 1, 12, 0), '12h')).toBe('12:00pm');
  });

  it('does not pad the hour in 12h format', () => {
    expect(formatClock(new Date(2026, 0, 2, 3, 4), '12h')).toBe('3:04am');
  });

  it('shows the last minute of the day as 11:59pm in 12h format', () => {
    expect(formatClock(new Date(2026, 0, 2, 23, 59), '12h')).toBe('11:59pm');
  });
});
