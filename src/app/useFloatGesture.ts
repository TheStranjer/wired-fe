/**
 * Dragging and resizing floats with the pointer (WFE-222). A gesture starts
 * on a pointer-down, then follows the pointer on the document until it is
 * released, dispatching each step as a fraction of the float layer's size so
 * the layout reducer can clamp it. A new gesture, or unmounting, ends the one
 * in progress.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent, PointerEventHandler, RefObject } from 'react';

import type { Dispatch } from '../state/StateContext';
import type { LayoutAction } from '../windows/layoutAction';

/** What the pointer is doing to the float: moving it or resizing its corner. */
export type Gesture = 'move' | 'resize';

/** A pointer step: (dx, dy) viewport fractions of one gesture on one float. */
type Step = {
  readonly gesture: Gesture;
  readonly paneId: string;
  readonly dx: number;
  readonly dy: number;
};

/** The layout action for a pointer step. */
function stepAction({ gesture, paneId, dx, dy }: Step): LayoutAction {
  if (gesture === 'move') {
    return { type: 'moveFloat', paneId, dx, dy };
  }
  return { type: 'resizeFloat', paneId, dw: dx, dh: dy };
}

/**
 * A maker of pointer-down handlers: `begin(paneId, gesture)` is the handler
 * for the element that starts that gesture on the float `paneId`. Sizes are
 * read from `layerRef` when the gesture starts.
 */
export function useFloatGesture(
  layerRef: RefObject<HTMLElement | null>,
  dispatch: Dispatch,
): (paneId: string, gesture: Gesture) => PointerEventHandler<HTMLElement> {
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      stopRef.current?.();
    },
    [],
  );
  return useCallback(
    (paneId, gesture) => (event: PointerEvent<HTMLElement>) => {
      const bounds = layerRef.current?.getBoundingClientRect();
      if (bounds === undefined) {
        return;
      }
      stopRef.current?.();
      event.preventDefault();
      const width = Math.max(bounds.width, 1);
      const height = Math.max(bounds.height, 1);
      let last = { x: event.clientX, y: event.clientY };
      const onMove = (move: globalThis.PointerEvent): void => {
        const dx = (move.clientX - last.x) / width;
        const dy = (move.clientY - last.y) / height;
        last = { x: move.clientX, y: move.clientY };
        dispatch({ type: 'layout', action: stepAction({ gesture, paneId, dx, dy }) });
      };
      const end = (): void => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', end);
        document.removeEventListener('pointercancel', end);
        stopRef.current = null;
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
      stopRef.current = end;
    },
    [layerRef, dispatch],
  );
}
