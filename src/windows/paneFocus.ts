/**
 * Moving focus between the panes and floats of the active desktop (ARCHITECTURE.md
 * decision 12) and swapping the focused pane with its neighbour: the pure side
 * of `/focus` and `/swap`. Every function hands back the state it was given
 * when nothing applies (an edge, an empty desktop), so the command stays quiet.
 */
import type { Desktop } from './desktopPanes';
import { activeDesktop, updateActive } from './desktops';
import type { DesktopsState } from './desktops';
import type { FloatRect } from './floats';
import { neighbour, paneRects } from './splitGeometry';
import type { Direction } from './splitGeometry';
import { findPane, panes } from './splitTree';
import type { SplitTree } from './splitTree';
import { swapPanes } from './splitTreeOps';

/** Where `/focus` can go: a neighbouring pane, or the next or previous pane in the cycle. */
export type FocusStep = Direction | 'next' | 'prev';

type Point = { readonly x: number; readonly y: number };

type Scored = { readonly id: string; readonly distance: number };

/** The middle of a rectangle. */
function centre(rect: FloatRect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Whether `to` lies strictly on the `direction` side of `from`. */
function lies(from: Point, to: Point, direction: Direction): boolean {
  switch (direction) {
    case 'left':
      return to.x < from.x;
    case 'right':
      return to.x > from.x;
    case 'up':
      return to.y < from.y;
    case 'down':
      return to.y > from.y;
  }
}

/**
 * The tree pane whose centre is nearest to the centre of the float `rect`
 * among those that lie in `direction` from it; the first in tree order on a
 * tie. Null when no pane lies that way.
 */
function nearestPane(tree: SplitTree, rect: FloatRect, direction: Direction): string | null {
  const origin = centre(rect);
  const scored = [...paneRects(tree)].flatMap(([id, paneRect]): Scored[] => {
    const to = centre(paneRect);
    return lies(origin, to, direction)
      ? [{ id, distance: Math.hypot(to.x - origin.x, to.y - origin.y) }]
      : [];
  });
  const best = scored.reduce<Scored | null>(
    (kept, next) => (kept !== null && kept.distance <= next.distance ? kept : next),
    null,
  );
  return best?.id ?? null;
}

/** The pane in `direction` of the focused one: a neighbour of a tree pane, the nearest tree pane to a float. */
function directional(desktop: Desktop, direction: Direction): string | null {
  const { tree, floats, focusedPaneId } = desktop;
  if (tree === null || focusedPaneId === null) {
    return null;
  }
  if (findPane(tree, focusedPaneId) !== null) {
    return neighbour(tree, focusedPaneId, direction);
  }
  const float = floats.find((candidate) => candidate.paneId === focusedPaneId);
  return float === undefined ? null : nearestPane(tree, float.rect, direction);
}

/** Every pane id of the desktop: tree panes in order, then floats in z-order. */
function cycleOrder(desktop: Desktop): readonly string[] {
  const inTree = desktop.tree === null ? [] : panes(desktop.tree).map((pane) => pane.paneId);
  return [...inTree, ...desktop.floats.map((float) => float.paneId)];
}

/** The pane after (`next`) or before (`prev`) the focused one in {@link cycleOrder}, wrapping; unfocused starts at an end. */
function cycled(desktop: Desktop, step: 'next' | 'prev'): string | null {
  const order = cycleOrder(desktop);
  const at = desktop.focusedPaneId === null ? -1 : order.indexOf(desktop.focusedPaneId);
  const from = at === -1 && step === 'prev' ? 0 : at;
  const offset = step === 'next' ? 1 : -1;
  return order[(from + offset + order.length) % order.length] ?? null;
}

/**
 * The active desktop's focus moved by `step`. A float takes focus where it is
 * in the stack, not raised, so that cycling visits every float. Unchanged at an
 * edge, on an empty desktop or when the step lands on the focused pane.
 */
export function moveFocus(state: DesktopsState, step: FocusStep): DesktopsState {
  const desktop = activeDesktop(state);
  const target =
    step === 'next' || step === 'prev' ? cycled(desktop, step) : directional(desktop, step);
  if (target === null || target === desktop.focusedPaneId) {
    return state;
  }
  return updateActive(state, (current) => ({ ...current, focusedPaneId: target }));
}

/**
 * The desktop with the focused tree pane's window and its neighbour's in
 * `direction` exchanged; focus follows the window to the neighbour. Unchanged
 * at an edge, for a float, with no focus, or when both panes show one window.
 */
export function swapFocused(desktop: Desktop, direction: Direction): Desktop {
  const { tree, focusedPaneId } = desktop;
  if (tree === null || focusedPaneId === null || findPane(tree, focusedPaneId) === null) {
    return desktop;
  }
  const other = neighbour(tree, focusedPaneId, direction);
  if (other === null) {
    return desktop;
  }
  const swapped = swapPanes(tree, focusedPaneId, other);
  return swapped === tree ? desktop : { ...desktop, tree: swapped, focusedPaneId: other };
}
