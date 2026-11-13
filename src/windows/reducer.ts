/**
 * Transitions for the window list: open, close, activate, and the navigation
 * actions, which are built in navigation next door. Pure reducer: it reads its
 * state and returns a new one, never mutating the window objects or the array
 * it was given.
 */

import { STATUS_WINDOW_ID, withActive, windowId } from './model';
import type { WindowRef, WindowsState, WindowState } from './model';
import { activateNext, activateNumber, activatePrevious, moveWindow } from './navigation';

/** One thing that can happen to the window list. */
export type WindowsAction =
  | { readonly type: 'open'; readonly ref: WindowRef; readonly title: string }
  | { readonly type: 'close'; readonly id: string }
  | { readonly type: 'activate'; readonly id: string }
  | { readonly type: 'activateNumber'; readonly number: number }
  | { readonly type: 'next' }
  | { readonly type: 'previous' }
  | { readonly type: 'move'; readonly id: string; readonly toNumber: number };

/** Apply a window action. Returns the same state when the action changes nothing. */
export function windowsReducer(state: WindowsState, action: WindowsAction): WindowsState {
  switch (action.type) {
    case 'open':
      return openWindow(state, action.ref, action.title);
    case 'close':
      return closeWindow(state, action.id);
    case 'activate':
      return withActive(state, action.id);
    case 'activateNumber':
      return activateNumber(state, action.number);
    case 'next':
      return activateNext(state);
    case 'previous':
      return activatePrevious(state);
    case 'move':
      return moveWindow(state, action.id, action.toNumber);
  }
}

/**
 * Show a view: activate the window that already has it, keeping its title, or
 * append a fresh one at the end of the list and make it active.
 */
function openWindow(state: WindowsState, ref: WindowRef, title: string): WindowsState {
  const id = windowId(ref);
  if (state.windows.some((win) => win.id === id)) {
    return withActive(state, id);
  }
  const fresh: WindowState = { id, ref, title, unread: 0, highlight: false };
  return { windows: [...state.windows, fresh], activeId: id };
}

/**
 * Drop a window. The status window and unknown ids are left alone; closing the
 * active window activates the one before it, which always exists because the
 * status window is first.
 */
function closeWindow(state: WindowsState, id: string): WindowsState {
  if (id === STATUS_WINDOW_ID) {
    return state;
  }
  const index = state.windows.findIndex((win) => win.id === id);
  if (index === -1) {
    return state;
  }
  const windows = state.windows.filter((win) => win.id !== id);
  if (state.activeId !== id) {
    return { ...state, windows };
  }
  const previous = windows.at(index - 1);
  return { windows, activeId: previous?.id ?? STATUS_WINDOW_ID };
}
