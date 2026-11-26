import { describe, expect, it, vi } from 'vitest';

import { currentMoment } from './time';

describe(currentMoment, () => {
  it('is the moment it is asked at', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4));

    expect(currentMoment()).toStrictEqual(new Date(2026, 0, 2, 3, 4));

    vi.useRealTimers();
  });
});
