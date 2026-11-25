/**
 * Where a popup opens (WFE-265): under its anchor, unless it would run past the
 * bottom of the screen or of the scrollback it sits in and there is room above.
 */
import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

/** Whether a popup at {@link popup}, under an anchor at {@link anchor}, belongs above it. */
export function opensAbove(popup: DOMRect, anchor: DOMRect, limit: number): boolean {
  return popup.bottom > limit && anchor.top - popup.height >= 0;
}

/** The lowest edge a popup may reach: the screen's, or its scrollback's if that is higher. */
function limitOf(popup: Element): number {
  const log = popup.closest('[role="log"]');
  return log === null
    ? window.innerHeight
    : Math.min(window.innerHeight, log.getBoundingClientRect().bottom);
}

/**
 * Right after {@link popup} mounts, mark it `data-above` when it belongs above
 * its parent, which is the anchor it hangs from. A DOM attribute rather than
 * state: the stylesheet does the moving, and nothing renders twice.
 */
export function useFlipAbove(popup: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = popup.current;
    const anchor = element?.parentElement?.getBoundingClientRect();
    if (element !== null && anchor !== undefined) {
      const above = opensAbove(element.getBoundingClientRect(), anchor, limitOf(element));
      element.toggleAttribute('data-above', above);
    }
  }, [popup]);
}
