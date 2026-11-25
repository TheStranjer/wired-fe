/**
 * Geometry of a split tree (ARCHITECTURE.md decision 12): the rectangle of
 * every pane in unit space, and the neighbouring pane in a direction, for
 * directional focus and swapping. Pure; no DOM.
 */
import type { SplitTree } from './splitTree';

/** A rectangle in unit space: the whole desktop is `{ x: 0, y: 0, w: 1, h: 1 }`. */
export type Rect = { x: number; y: number; w: number; h: number };

/** A direction to look from a pane. */
export type Direction = 'left' | 'right' | 'up' | 'down';

/** Tolerance for comparing edges and overlaps. */
const EPSILON = 1e-9;

type Candidate = { readonly id: string; readonly overlap: number };

function fill(tree: SplitTree, rect: Rect, out: Map<string, Rect>): void {
  if (tree.type === 'pane') {
    out.set(tree.paneId, rect);
    return;
  }
  const { x, y, w, h } = rect;
  if (tree.dir === 'row') {
    const aw = w * tree.ratio;
    fill(tree.a, { x, y, w: aw, h }, out);
    fill(tree.b, { x: x + aw, y, w: w - aw, h }, out);
    return;
  }
  const ah = h * tree.ratio;
  fill(tree.a, { x, y, w, h: ah }, out);
  fill(tree.b, { x, y: y + ah, w, h: h - ah }, out);
}

/**
 * The rectangle of every pane, by pane id, in unit space. `row` splits divide
 * the width by `ratio`, `column` splits divide the height. Entries are in tree
 * order (left to right, top to bottom).
 */
export function paneRects(tree: SplitTree): ReadonlyMap<string, Rect> {
  const out = new Map<string, Rect>();
  fill(tree, { x: 0, y: 0, w: 1, h: 1 }, out);
  return out;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

/** Whether `other` lies against the `direction` edge of `from`. */
function touches(from: Rect, other: Rect, direction: Direction): boolean {
  switch (direction) {
    case 'left':
      return near(other.x + other.w, from.x);
    case 'right':
      return near(other.x, from.x + from.w);
    case 'up':
      return near(other.y + other.h, from.y);
    case 'down':
      return near(other.y, from.y + from.h);
  }
}

type Range = readonly [start: number, end: number];

function span(a: Range, b: Range): number {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
}

/** How far the two rectangles overlap along the axis perpendicular to `direction`. */
function overlapAlong(from: Rect, other: Rect, direction: Direction): number {
  if (direction === 'left' || direction === 'right') {
    return span([from.y, from.y + from.h], [other.y, other.y + other.h]);
  }
  return span([from.x, from.x + from.w], [other.x, other.x + other.w]);
}

type Query = { readonly paneId: string; readonly from: Rect; readonly direction: Direction };

/** The panes against the `direction` edge of `paneId` that share some of its length. */
function candidates(rects: ReadonlyMap<string, Rect>, query: Query): readonly Candidate[] {
  const { paneId, from, direction } = query;
  return [...rects].flatMap(([id, rect]) => {
    const overlap = overlapAlong(from, rect, direction);
    const adjacent = id !== paneId && touches(from, rect, direction) && overlap > EPSILON;
    return adjacent ? [{ id, overlap }] : [];
  });
}

/**
 * The pane against the `direction` edge of `paneId` that overlaps it most along
 * the other axis. Ties go to the one nearest the top-left: candidates on one
 * edge are disjoint, so they come in tree order, which is top-left first, and
 * the earlier one is kept. Null at the edge of the desktop (no wrapping) or
 * for an unknown pane id.
 */
export function neighbour(tree: SplitTree, paneId: string, direction: Direction): string | null {
  const rects = paneRects(tree);
  const from = rects.get(paneId);
  if (from === undefined) {
    return null;
  }
  const best = candidates(rects, { paneId, from, direction }).reduce<Candidate | null>(
    (kept, next) => (kept !== null && next.overlap <= kept.overlap + EPSILON ? kept : next),
    null,
  );
  return best?.id ?? null;
}
