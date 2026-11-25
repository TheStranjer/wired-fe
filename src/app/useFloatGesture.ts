/**
 * Dragging and resizing floats with the pointer (WFE-222). A gesture starts
 * on a pointer-down, then follows the pointer on the document until it is
 * released, dispatching each step as a fraction of the float layer's size so
 * the layout reducer can clamp it. A new gesture, or unmounting, ends the one
 * in progress. While a float is moved with Shift held (WFE-231) the tree pane
 * under the pointer is reported as a dock target, and releasing there docks.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent, PointerEventHandler, RefObject } from 'react';

import type { Dispatch } from '../state/StateContext';
import { dropTarget } from '../windows/dropZone';
import type { DropTarget } from '../windows/dropZone';
import type { LayoutAction } from '../windows/layoutAction';
import type { SplitTree } from '../windows/splitTree';

/** What the pointer is doing to the float: moving it or resizing its corner. */
export type Gesture = 'move' | 'resize';

/** The tree a moved float may dock into, and where the hovered dock target is reported. */
export type DockSink = {
  readonly tree: SplitTree | null;
  readonly onTarget: (target: DropTarget | null) => void;
};

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
 * Follows the pointer on the document: `onMove` for each move, `onEnd` once on
 * release (with the event) or cancel (with null). Returns a function that
 * stops following.
 */
function track(
  onMove: (move: globalThis.PointerEvent) => void,
  onEnd: (up: globalThis.PointerEvent | null) => void,
): () => void {
  const stop = new AbortController();
  const options = { signal: stop.signal };
  document.addEventListener('pointermove', onMove, options);
  document.addEventListener(
    'pointerup',
    (up) => {
      stop.abort();
      onEnd(up);
    },
    options,
  );
  document.addEventListener(
    'pointercancel',
    () => {
      stop.abort();
      onEnd(null);
    },
    options,
  );
  return () => {
    stop.abort();
  };
}

/** Everything one gesture needs: the layer's size and position, where to send steps, which float. */
type Start = {
  readonly bounds: DOMRect;
  readonly dispatch: Dispatch;
  readonly dock: DockSink;
  readonly paneId: string;
  readonly gesture: Gesture;
};

/**
 * Follows the pointer from the pointer-down `event`: each move is dispatched
 * as a step, and a release over a dock target (Shift held, moves only) docks.
 * `done` runs when the gesture ends by itself. Returns the function that ends
 * it early.
 */
function follow(start: Start, event: PointerEvent<HTMLElement>, done: () => void): () => void {
  const { bounds, dispatch, dock, paneId, gesture } = start;
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const probe = (at: globalThis.PointerEvent): DropTarget | null =>
    gesture === 'move' && at.shiftKey
      ? dropTarget(dock.tree, {
          x: (at.clientX - bounds.left) / width,
          y: (at.clientY - bounds.top) / height,
        })
      : null;
  let last = { x: event.clientX, y: event.clientY };
  const remove = track(
    (move) => {
      const dx = (move.clientX - last.x) / width;
      const dy = (move.clientY - last.y) / height;
      last = { x: move.clientX, y: move.clientY };
      dispatch({ type: 'layout', action: stepAction({ gesture, paneId, dx, dy }) });
      dock.onTarget(probe(move));
    },
    (up) => {
      done();
      const target = up === null ? null : probe(up);
      dock.onTarget(null);
      if (target !== null) {
        const { paneId: targetPaneId, edge } = target;
        const action = { type: 'dockAt', floatPaneId: paneId, targetPaneId, edge } as const;
        dispatch({ type: 'layout', action });
      }
    },
  );
  return () => {
    remove();
    dock.onTarget(null);
  };
}

/**
 * A maker of pointer-down handlers: `begin(paneId, gesture)` is the handler
 * for the element that starts that gesture on the float `paneId`. Sizes are
 * read from `layerRef` when the gesture starts.
 */
export function useFloatGesture(
  layerRef: RefObject<HTMLElement | null>,
  dispatch: Dispatch,
  dock: DockSink,
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
      const start: Start = { bounds, dispatch, dock, paneId, gesture };
      stopRef.current = follow(start, event, () => {
        stopRef.current = null;
      });
    },
    [layerRef, dispatch, dock],
  );
}
