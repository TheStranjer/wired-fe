/**
 * The state of all desktops (ARCHITECTURE.md decisions 12 and 18): numbered
 * desktops, each a split tree plus floats with one focus, and one active. Pane
 * ids are `p<seq>` from `nextPaneSeq`, so everything is deterministic. The
 * transitions on a single desktop live in desktopPanes.ts. Pure: every
 * function returns the input unchanged when nothing applies.
 */
import { appendRefusal } from './desktopAppend';
import { dockDesktopPaneAt } from './desktopDock';
import {
  EMPTY_DESKTOP,
  dockDesktopPane,
  findPlaced,
  floatDesktopPane,
  focusDesktopPane,
  focusedWindow,
  insertDesktopPane,
  isEmptyDesktop,
  removeDesktopPane,
  splitDesktop,
} from './desktopPanes';
import type { Desktop } from './desktopPanes';
import type { DropEdge } from './dropZone';
import { singlePane } from './splitTree';
import type { SplitDir } from './splitTree';

/** Every desktop, in order, and which one is shown (`active` is a 0-based index). */
export type DesktopsState = {
  readonly desktops: readonly Desktop[];
  readonly active: number;
  readonly nextPaneSeq: number;
};

/** One desktop with one focused pane showing `windowId`. */
export function initialDesktops(windowId: string): DesktopsState {
  const tree = singlePane('p1', windowId);
  return { desktops: [{ tree, floats: [], focusedPaneId: 'p1' }], active: 0, nextPaneSeq: 2 };
}

/** The desktop being shown. */
export function activeDesktop(state: DesktopsState): Desktop {
  return state.desktops[state.active] ?? EMPTY_DESKTOP;
}

/** The window of the focused pane or float on the active desktop, or null. */
export function focusedWindowId(state: DesktopsState): string | null {
  return focusedWindow(activeDesktop(state));
}

/** Applies `change` to the active desktop; the same state when it returns the desktop it was given. */
export function updateActive(
  state: DesktopsState,
  change: (desktop: Desktop) => Desktop,
): DesktopsState {
  const current = activeDesktop(state);
  const next = change(current);
  if (next === current) {
    return state;
  }
  return { ...state, desktops: state.desktops.map((d, i) => (i === state.active ? next : d)) };
}

/** Whether `n` can be a desktop number: a whole number from 1. */
function isDesktopNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1;
}

/** The desktops with empty ones appended until there are `count`. */
function padDesktops(desktops: readonly Desktop[], count: number): readonly Desktop[] {
  const missing = Array.from({ length: Math.max(count - desktops.length, 0) }, () => EMPTY_DESKTOP);
  return [...desktops, ...missing];
}

/**
 * Shows desktop `n` (1-based). The one just past the end is made empty when
 * the last desktop is not empty (see `appendRefusal`); any other number past
 * the end, or an append the rule refuses, leaves the state unchanged.
 */
export function goToDesktop(state: DesktopsState, n: number): DesktopsState {
  if (!isDesktopNumber(n) || n === state.active + 1 || appendRefusal(state, n) !== null) {
    return state;
  }
  const desktops = n > state.desktops.length ? [...state.desktops, EMPTY_DESKTOP] : state.desktops;
  return { ...state, desktops, active: n - 1 };
}

/**
 * Steps one desktop left or right: left of the first wraps to the last; right
 * of the last appends one only when the last desktop is not empty, else the
 * state is unchanged.
 */
export function stepDesktop(state: DesktopsState, step: 1 | -1): DesktopsState {
  const target = state.active + step;
  return goToDesktop(state, target < 0 ? state.desktops.length : target + 1);
}

/** Appends an empty desktop and shows it; unchanged when the last desktop is empty. */
export function newDesktop(state: DesktopsState): DesktopsState {
  return goToDesktop(state, state.desktops.length + 1);
}

/** Closes desktop `n` (1-based); never the last remaining one. The active index follows. */
export function closeDesktop(state: DesktopsState, n: number): DesktopsState {
  const index = n - 1;
  if (state.desktops.length < 2 || !isDesktopNumber(n) || n > state.desktops.length) {
    return state;
  }
  const desktops = state.desktops.filter((_, i) => i !== index);
  const active =
    state.active > index ? state.active - 1 : Math.min(state.active, desktops.length - 1);
  return { ...state, desktops, active };
}

/** Closes every empty desktop except the active one, so at least that one stays. The active index follows. */
export function pruneDesktops(state: DesktopsState): DesktopsState {
  const kept = state.desktops.filter((d, i) => i === state.active || !isEmptyDesktop(d));
  if (kept.length === state.desktops.length) {
    return state;
  }
  const active = state.desktops.slice(0, state.active).filter((d) => !isEmptyDesktop(d)).length;
  return { ...state, desktops: kept, active };
}

/** Focuses a pane or float of the active desktop; a float is raised. */
export function focusPane(state: DesktopsState, paneId: string): DesktopsState {
  return updateActive(state, (desktop) => focusDesktopPane(desktop, paneId));
}

/** Splits the focused pane (or starts an empty desktop) with a pane showing `windowId`, and focuses it. */
export function splitFocused(state: DesktopsState, dir: SplitDir, windowId: string): DesktopsState {
  const paneId = `p${String(state.nextPaneSeq)}`;
  const split = updateActive(state, (desktop) => splitDesktop(desktop, dir, paneId, windowId));
  return split === state ? state : { ...split, nextPaneSeq: state.nextPaneSeq + 1 };
}

/** Closes the focused pane or float; focus goes to its sibling, else the topmost float, else nothing. */
export function closeFocusedPane(state: DesktopsState): DesktopsState {
  return updateActive(state, (desktop) =>
    desktop.focusedPaneId === null ? desktop : removeDesktopPane(desktop, desktop.focusedPaneId),
  );
}

/** Tears the focused tree pane off into a float. */
export function floatFocused(state: DesktopsState): DesktopsState {
  return updateActive(state, floatDesktopPane);
}

/** Docks the focused float into the tree beside the last pane. */
export function dockFocused(state: DesktopsState): DesktopsState {
  return updateActive(state, dockDesktopPane);
}

/** Docks the float `floatPaneId` against the `edge` of the tree pane `targetPaneId`. */
export function dockAt(
  state: DesktopsState,
  floatPaneId: string,
  ...target: readonly [targetPaneId: string, edge: DropEdge]
): DesktopsState {
  return updateActive(state, (desktop) => dockDesktopPaneAt(desktop, floatPaneId, ...target));
}

/** Moves a pane or float, wherever it is, to desktop `n` (created when missing); the view stays put. */
export function movePaneToDesktop(state: DesktopsState, paneId: string, n: number): DesktopsState {
  const from = state.desktops.findIndex((desktop) => findPlaced(desktop, paneId) !== null);
  const placed = findPlaced(state.desktops[from] ?? EMPTY_DESKTOP, paneId);
  if (placed === null || !isDesktopNumber(n) || from === n - 1) {
    return state;
  }
  const desktops = padDesktops(state.desktops, n).map((desktop, i) => {
    if (i === from) {
      return removeDesktopPane(desktop, paneId);
    }
    return i === n - 1 ? insertDesktopPane(desktop, placed) : desktop;
  });
  return { ...state, desktops };
}
