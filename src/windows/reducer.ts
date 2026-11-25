/**
 * Transitions for the window list: open, close, activate, the navigation
 * actions, which are built in navigation next door, and the unread tracking
 * built in unread next door. Pure reducer: it reads its state and returns a
 * new one, never mutating the window objects or the array it was given.
 */

import { setDisplay } from './display';
import type { DisplayChange } from './display';
import { STATUS_WINDOW_ID, withAccountKey, withActive, windowId } from './model';
import type { WindowRef, WindowsState, WindowState } from './model';
import { activateNext, activateNumber, activatePrevious, moveWindow } from './navigation';
import { markRead, markUnread } from './unread';

/** One thing that can happen to the window list. */
export type WindowsAction =
  | { readonly type: 'open'; readonly ref: WindowRef; readonly title: string }
  | { readonly type: 'close'; readonly id: string }
  | { readonly type: 'activate'; readonly id: string }
  | { readonly type: 'setAccount'; readonly id: string; readonly accountKey: string }
  | { readonly type: 'activateNumber'; readonly number: number }
  | { readonly type: 'next' }
  | { readonly type: 'previous' }
  | { readonly type: 'move'; readonly id: string; readonly toNumber: number }
  | {
      readonly type: 'markUnread';
      readonly id: string;
      readonly count: number;
      readonly highlight: boolean;
    }
  | { readonly type: 'markRead'; readonly id: string }
  | { readonly type: 'setDisplay'; readonly id: string; readonly overrides: DisplayChange };

/** The two actions that track what a window has unread. */
type UnreadAction = Extract<WindowsAction, { readonly type: 'markUnread' | 'markRead' }>;

/** Whether {@link action} is one of the unread-tracking actions. */
function isUnreadAction(action: WindowsAction): action is UnreadAction {
  return action.type === 'markUnread' || action.type === 'markRead';
}

/** Apply an unread-tracking action. */
function unreadReducer(state: WindowsState, action: UnreadAction): WindowsState {
  switch (action.type) {
    case 'markUnread':
      return markUnread(state, action.id, action.count, action.highlight);
    case 'markRead':
      return markRead(state, action.id);
  }
}

/** Apply a window action. Returns the same state when the action changes nothing. */
export function windowsReducer(state: WindowsState, action: WindowsAction): WindowsState {
  if (isUnreadAction(action)) {
    return unreadReducer(state, action);
  }
  if (isNavigation(action)) {
    return navigate(state, action);
  }
  switch (action.type) {
    case 'open':
      return openWindow(state, action.ref, action.title);
    case 'close':
      return closeWindow(state, action.id);
    case 'activate':
      return withActive(state, action.id);
    case 'setAccount':
      return withAccountKey(state, action.id, action.accountKey);
    case 'setDisplay':
      return setDisplay(state, action.id, action.overrides);
  }
}

/** The actions that move through or around the list, built in navigation next door. */
type NavigationAction = Extract<
  WindowsAction,
  { readonly type: 'activateNumber' | 'next' | 'previous' | 'move' }
>;

/** Whether {@link action} is one of the {@link NavigationAction}s. */
function isNavigation(action: WindowsAction): action is NavigationAction {
  return (
    action.type === 'activateNumber' ||
    action.type === 'next' ||
    action.type === 'previous' ||
    action.type === 'move'
  );
}

/** Apply a navigation action. */
function navigate(state: WindowsState, action: NavigationAction): WindowsState {
  switch (action.type) {
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
  const fresh: WindowState = { id, ref, title, unread: 0, highlight: false, display: {} };
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
