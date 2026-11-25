/**
 * Tests for the middle-button handler (WFE-238): the middle button reaches
 * the handler with the browser's own behaviour taken off it, the other
 * auxiliary buttons never do.
 */
import type { MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { onMiddleClick } from './middleClick';

/** An auxiliary click of {@link button} and the spy on its default. */
function aux(button: number): {
  readonly event: MouseEvent<HTMLElement>;
  readonly preventDefault: () => void;
} {
  const preventDefault = vi.fn<() => void>();
  const event = {
    button,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault,
  } as unknown as MouseEvent<HTMLElement>;
  return { event, preventDefault };
}

describe(onMiddleClick, () => {
  it('hands the middle click to the handler and prevents its default', () => {
    const handler = vi.fn<() => void>();
    const { event, preventDefault } = aux(1);

    onMiddleClick(handler)(event);

    expect(handler).toHaveBeenCalledExactlyOnceWith(event);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('ignores the right button', () => {
    const handler = vi.fn<() => void>();
    const { event, preventDefault } = aux(2);

    onMiddleClick(handler)(event);

    expect(handler).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
