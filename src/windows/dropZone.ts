/**
 * Where a dragged float would dock (ARCHITECTURE.md decision 12): the tree
 * pane under the pointer and the edge of it nearest the pointer. Pure; the
 * pointer and the rectangles share unit space (the whole desktop is 0..1).
 */
import { paneRects } from './splitGeometry';
import type { Rect } from './splitGeometry';
import type { SplitTree } from './splitTree';

/** The edge of a pane a float docks against. */
export type DropEdge = 'left' | 'right' | 'top' | 'bottom';

/** A point in unit space. */
export type Point = { readonly x: number; readonly y: number };

/** The pane under the pointer, the edge nearest it, and the half of the pane that edge claims. */
export type DropTarget = {
  readonly paneId: string;
  readonly edge: DropEdge;
  readonly zone: Rect;
};

/**
 * The edge of `paneRect` nearest the pointer, measured as a share of the
 * pane's own width or height so a wide pane and a tall one split alike. Ties go
 * to left, then right, then top, then bottom.
 */
export function dropZone(paneRect: Rect, pointer: Point): DropEdge {
  const left = (pointer.x - paneRect.x) / paneRect.w;
  const top = (pointer.y - paneRect.y) / paneRect.h;
  const distances: readonly (readonly [DropEdge, number])[] = [
    ['left', left],
    ['right', 1 - left],
    ['top', top],
    ['bottom', 1 - top],
  ];
  const [nearest] = distances.reduce((best, next) => (next[1] < best[1] ? next : best));
  return nearest;
}

/** The half of `paneRect` on the `edge` side. */
export function zoneRect(paneRect: Rect, edge: DropEdge): Rect {
  const { x, y, w, h } = paneRect;
  switch (edge) {
    case 'left':
      return { x, y, w: w / 2, h };
    case 'right':
      return { x: x + w / 2, y, w: w / 2, h };
    case 'top':
      return { x, y, w, h: h / 2 };
    case 'bottom':
      return { x, y: y + h / 2, w, h: h / 2 };
  }
}

/** Whether `point` lies inside `rect`, edges included. */
function contains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

/** The tree pane under `pointer` with the dock edge nearest it, or null over no pane. */
export function dropTarget(tree: SplitTree | null, pointer: Point): DropTarget | null {
  const rects = tree === null ? [] : [...paneRects(tree)];
  const hit = rects.find(([, rect]) => contains(rect, pointer));
  if (hit === undefined) {
    return null;
  }
  const [paneId, rect] = hit;
  const edge = dropZone(rect, pointer);
  return { paneId, edge, zone: zoneRect(rect, edge) };
}
