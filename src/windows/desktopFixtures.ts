/**
 * Shared test helpers for the desktops model: small desktops and states to
 * assert shapes against.
 */
import { EMPTY_DESKTOP, splitDesktop } from './desktopPanes';
import type { Desktop } from './desktopPanes';
import { goToDesktop, initialDesktops, splitFocused } from './desktops';
import type { DesktopsState } from './desktops';
import { addFloat } from './floats';
import type { FloatRect } from './floats';
import { shape } from './splitTreeFixtures';

/** A rectangle well inside the viewport. */
export const RECT: FloatRect = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };

/** `row(p1:w1 col(p2:w2 p3:w3))`, focus on p3. */
export function threePanes(): Desktop {
  const one = splitDesktop(EMPTY_DESKTOP, 'row', 'p1', 'w1');
  const two = splitDesktop(one, 'row', 'p2', 'w2');
  return splitDesktop(two, 'column', 'p3', 'w3');
}

/** `p1:w1` in the tree and floats p2 (below) and p3 (on top); focus on p3. */
export function withFloats(): Desktop {
  const tree = splitDesktop(EMPTY_DESKTOP, 'row', 'p1', 'w1');
  const floats = addFloat(addFloat([], 'p2', 'w2', RECT), 'p3', 'w3', RECT);
  return { ...tree, floats, focusedPaneId: 'p3' };
}

/** The text form of a desktop's tree, or null when it has none. */
export function treeShape(desktop: Desktop): string | null {
  return desktop.tree === null ? null : shape(desktop.tree);
}

/** The text form of desktop `n`'s tree (1-based). */
export function treeOf(state: DesktopsState, n: number): string | null | undefined {
  return state.desktops.map(treeShape)[n - 1];
}

/** Desktop 1: `row(p1:w1 p2:w2)`, focus p2. */
export function twoPanes(): DesktopsState {
  return splitFocused(initialDesktops('w1'), 'row', 'w2');
}

/** Three desktops, the second active. */
export function three(): DesktopsState {
  return goToDesktop(goToDesktop(twoPanes(), 3), 2);
}
