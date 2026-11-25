/**
 * Shared test helpers for the layout sync tests: four windows, desktops of
 * side-by-side panes, and slices of the app state that are already in step.
 */
import type { SyncSlice } from './layoutSync';
import { focusedWindowId, initialDesktops, splitFocused } from '../windows/desktops';
import type { DesktopsState } from '../windows/desktops';
import { STATUS_WINDOW_ID, initialWindowsState, windowId, withActive } from '../windows/model';
import type { WindowRef, WindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';
import { panes } from '../windows/splitTree';

/** A thread window of the named target. */
export function thread(target: string): WindowRef {
  return { kind: 'thread', accountKey: 'k', target };
}

export const A = windowId(thread('a'));
export const B = windowId(thread('b'));
export const C = windowId(thread('c'));

/** Status, a, b and c, status active. */
export function fourWindows(): WindowsState {
  const opened = ['a', 'b', 'c'].reduce<WindowsState>(
    (state, target) => windowsReducer(state, { type: 'open', ref: thread(target), title: target }),
    initialWindowsState(),
  );
  return withActive(opened, STATUS_WINDOW_ID);
}

/** One desktop with a pane per window given, side by side; the last pane has focus. */
export function layoutOf(first: string, ...rest: readonly string[]): DesktopsState {
  return rest.reduce((state, id) => splitFocused(state, 'row', id), initialDesktops(first));
}

/** The windows and desktops in step: the focused pane's window is the active one. */
export function slice(first: string, ...rest: readonly string[]): SyncSlice {
  const layout = layoutOf(first, ...rest);
  return { windows: withActive(fourWindows(), rest.at(-1) ?? first), layout };
}

/** The window of the focused pane. */
export function focused(state: SyncSlice): string | null {
  return focusedWindowId(state.layout);
}

/** The window list with `count` unread lines given to `id`, which no layout is told about. */
export function unreadIn(state: SyncSlice, id: string, count: number): SyncSlice {
  const marked = windowsReducer(state.windows, { type: 'markUnread', id, count, highlight: false });
  return { ...state, windows: marked };
}

/** For each desktop in order, whether it has a pane or float showing `id`. */
export function shownOn(layout: DesktopsState, id: string): readonly boolean[] {
  return layout.desktops.map(({ tree, floats }) => {
    const inTree = tree === null ? [] : panes(tree);
    return [...inTree, ...floats].some((pane) => pane.windowId === id);
  });
}

/** How many unread lines window `id` holds. */
export function unreadOf(state: SyncSlice, id: string): number | undefined {
  return state.windows.windows.find((win) => win.id === id)?.unread;
}
