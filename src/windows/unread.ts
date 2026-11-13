/**
 * Unread tracking for the window list: what a window gathered while it was not
 * on screen, shown by the status line as `2:home(3)` with a `*` for a highlight
 * (AGENTS.md "Windows, like IRC buffers"). One pure function per reducer
 * action, plus the total the window commands ask for; like the rest of the
 * layer, each hands back the very same state when there is nothing to change.
 * Activation acknowledges a window through `withActive`, so only inactive
 * windows ever accumulate here.
 */

import type { WindowsState, WindowState } from './model';

/**
 * Record that the window with `id` received `count` new lines, `highlight`
 * when one of them mentions or DMs the user. The active window sees its lines
 * as they arrive and an unknown id names no window to mark; a count that is
 * not a whole non-negative number, and a mark that would change nothing,
 * leave the state as it was. Once a window is highlighted it stays so.
 * `count` and `highlight` ride a rest tuple: four plain parameters would
 * break the 3-parameter limit while callers still pass the four arguments
 * this interface fixes.
 */
export function markUnread(
  state: WindowsState,
  id: string,
  ...[count, highlight]: [count: number, highlight: boolean]
): WindowsState {
  if (id === state.activeId || !Number.isInteger(count) || count < 0) {
    return state;
  }
  const existing = state.windows.find((win) => win.id === id);
  if (existing === undefined) {
    return state;
  }
  if (count === 0 && (existing.highlight || !highlight)) {
    return state;
  }
  return replaceWindow(state, {
    ...existing,
    unread: existing.unread + count,
    highlight: existing.highlight || highlight,
  });
}

/**
 * Acknowledge the window with `id`: its unread count goes to zero and its
 * highlight is dropped. An unknown id and an already clear window leave the
 * state as it was.
 */
export function markRead(state: WindowsState, id: string): WindowsState {
  const existing = state.windows.find((win) => win.id === id);
  if (existing === undefined || (existing.unread === 0 && !existing.highlight)) {
    return state;
  }
  return replaceWindow(state, { ...existing, unread: 0, highlight: false });
}

/** How many unread lines all the windows together are holding. */
export function totalUnread(state: WindowsState): number {
  return state.windows.reduce((sum, win) => sum + win.unread, 0);
}

/** The same list of windows with `updated` in place of the one of its id. */
function replaceWindow(state: WindowsState, updated: WindowState): WindowsState {
  return {
    ...state,
    windows: state.windows.map((win) => (win.id === updated.id ? updated : win)),
  };
}
