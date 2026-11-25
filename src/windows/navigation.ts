/**
 * Window navigation: `/win N`, bare digits, `Alt+ArrowLeft/ArrowRight` and
 * `/win move` (AGENTS.md "Windows, like IRC buffers"). One pure function per
 * reducer action; each hands back the very same state when the request names
 * no move to make. Activation always goes through `withActive`, so every path
 * that brings a window forward also acknowledges what it had unread.
 */

import { STATUS_WINDOW_ID, withActive } from './model';
import type { WindowsState } from './model';

/**
 * Activate the window listed at 1-based `number`. A number that names no
 * window, out of range or not whole, leaves the state as it was.
 */
export function activateNumber(state: WindowsState, number: number): WindowsState {
  return activateAt(state, number - 1);
}

/** Activate the window after the active one, wrapping from the last to the first. */
export function activateNext(state: WindowsState): WindowsState {
  return activateRelative(state, 1);
}

/** Activate the window before the active one, wrapping from the first to the last. */
export function activatePrevious(state: WindowsState): WindowsState {
  return activateRelative(state, -1);
}

/**
 * Move the window with `id` to 1-based position `toNumber`, shifting the
 * windows it passes. Window 1 is the status window: it never moves and
 * nothing moves into its place. Which window is active does not change.
 */
export function moveWindow(state: WindowsState, id: string, toNumber: number): WindowsState {
  const lastPosition = state.windows.length;
  if (
    id === STATUS_WINDOW_ID ||
    !Number.isInteger(toNumber) ||
    toNumber < 2 ||
    toNumber > lastPosition
  ) {
    return state;
  }
  const moved = state.windows.find((win) => win.id === id);
  if (moved === undefined) {
    return state;
  }
  const others = state.windows.filter((win) => win.id !== id);
  const insertAt = toNumber - 1;
  return {
    windows: [...others.slice(0, insertAt), moved, ...others.slice(insertAt)],
    activeId: state.activeId,
  };
}

/** Activate the window at 0-based `index`; there is no such window, do nothing. */
function activateAt(state: WindowsState, index: number): WindowsState {
  const win = state.windows[index];
  return win === undefined ? state : withActive(state, win.id);
}

/** Activate `step` windows along the list from the active one, wrapping. */
function activateRelative(state: WindowsState, step: number): WindowsState {
  const count = state.windows.length;
  if (count < 2) {
    return state;
  }
  const current = state.windows.findIndex((win) => win.id === state.activeId);
  return activateAt(state, wrap(current + step, count));
}

/** Keep a step result inside 0..count-1, so the ends wrap onto each other. */
function wrap(index: number, count: number): number {
  return ((index % count) + count) % count;
}
