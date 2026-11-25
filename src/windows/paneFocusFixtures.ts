/**
 * Shared test helpers for the pane focus tests: a 2×2 grid, a way to set
 * focus and a way to add a focused float.
 */
import { focusPane, initialDesktops, splitFocused, updateActive } from './desktops';
import type { DesktopsState } from './desktops';
import { addFloat } from './floats';
import type { FloatRect } from './floats';

/** A 2×2 grid, `row(col(p1:w1 p4:w3) col(p2:w2 p3:w4))`, focus on p4 (bottom left). */
export function grid(): DesktopsState {
  const right = splitFocused(initialDesktops('w1'), 'row', 'w2');
  const bottomRight = splitFocused(right, 'column', 'w4');
  return splitFocused(focusPane(bottomRight, 'p1'), 'column', 'w3');
}

/** {@link state} with its focus set to {@link paneId}, whether tree pane or float. */
export function focusOn(state: DesktopsState, paneId: string | null): DesktopsState {
  return updateActive(state, (desktop) => ({ ...desktop, focusedPaneId: paneId }));
}

/** {@link state} with a float `paneId` at {@link rect} on top, focused. */
export function withFloat(state: DesktopsState, paneId: string, rect: FloatRect): DesktopsState {
  return updateActive(state, (desktop) => ({
    ...desktop,
    floats: addFloat(desktop.floats, paneId, `w${paneId}`, rect),
    focusedPaneId: paneId,
  }));
}

/** A float whose centre is the middle of the desktop, equally far from every pane. */
export const MIDDLE: FloatRect = { x: 0.375, y: 0.375, w: 0.25, h: 0.25 };
