/**
 * Tests for the minute clock, on fake timers only (AGENTS.md: no test waits
 * on real time): the current minute formatted at mount, the re-render exactly
 * at the minute boundary, the timer re-armed for the next one, and the
 * pending timeout cleared on unmount.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useClock } from './useClock';

/** 23:04:30, so the next minute boundary is 30 seconds away. */
const START = new Date(2026, 10, 14, 23, 4, 30);

/** Run the fake clock for {@link ms}, flushing what its timers re-rendered. */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe(useClock, () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: START });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the current minute in the requested format', () => {
    const h24 = renderHook(() => useClock('24h'));
    const h12 = renderHook(() => useClock('12h'));

    expect(h24.result.current).toBe('23:04');
    expect(h12.result.current).toBe('11:04pm');

    h24.unmount();
    h12.unmount();
  });

  it('re-renders when the minute turns and re-arms for the next', () => {
    const { result } = renderHook(() => useClock('24h'));

    advance(29_999);

    expect(result.current).toBe('23:04');

    advance(1);

    expect(result.current).toBe('23:05');
    expect(vi.getTimerCount()).toBe(1);

    advance(60_000);

    expect(result.current).toBe('23:06');
  });

  it('clears its timeout when unmounted', () => {
    const { unmount } = renderHook(() => useClock('24h'));

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
