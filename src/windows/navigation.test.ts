/**
 * Window navigation: activating by number, stepping next and previous with
 * wrapping, and moving a window along the list. The same four tests the
 * reducer needs for delegation, and the promise that no call mutates.
 */
import { describe, expect, it } from 'vitest';

import { initialWindowsState, STATUS_WINDOW_ID, windowId } from './model';
import type { WindowKind, WindowRef, WindowsState, WindowState } from './model';
import { activateNext, activateNumber, activatePrevious, moveWindow } from './navigation';
import { windowsReducer } from './reducer';

const ACCOUNT = 'lain@wired.example';
const DM_TARGET = '@a3@wired.example';

/** A view on an account, with no target unless one is given. */
function ref(
  kind: WindowKind,
  target: string | null = null,
  accountKey: string | null = ACCOUNT,
): WindowRef {
  return { kind, accountKey, target };
}

/** The clean window `open` would make for a view. */
function windowFor(view: WindowRef, title: string = view.kind): WindowState {
  return { id: windowId(view), ref: view, title, unread: 0, highlight: false };
}

/** The window at a position in a list the test built itself. */
function at(state: WindowsState, index: number): WindowState {
  const win = state.windows.at(index);
  if (win === undefined) {
    throw new Error(`no window at position ${String(index)}`);
  }
  return win;
}

/** Status, home with two unread and a highlight, notifications, and an active dm. */
function fourWindows(): WindowsState {
  const status = windowFor(ref('status', null, null));
  const home = { ...windowFor(ref('home'), '@lain home'), unread: 2, highlight: true };
  const notifications = windowFor(ref('notifications'), 'notifications');
  const dm = windowFor(ref('dm', DM_TARGET), 'dm @a3');
  return { windows: [status, home, notifications, dm], activeId: dm.id };
}

/** The same four windows with `id` active instead. */
function active(state: WindowsState, id: string): WindowsState {
  return { ...state, activeId: id };
}

/** The ids of a state's windows, in list order. */
function ids(state: WindowsState): readonly string[] {
  return state.windows.map((win) => win.id);
}

/** Freeze a state and everything in it, the way the app hands state over. */
function deepFreeze(state: WindowsState): WindowsState {
  for (const win of state.windows) {
    Object.freeze(win.ref);
    Object.freeze(win);
  }
  Object.freeze(state.windows);
  return Object.freeze(state);
}

describe(activateNumber, () => {
  it('activates the window listed under that 1-based number', () => {
    const state = fourWindows();

    const next = activateNumber(state, 3);

    expect(next.activeId).toBe(at(state, 2).id);
    expect(ids(next)).toStrictEqual(ids(state));
  });

  it('clears the unread count and highlight of the window it activates', () => {
    const state = fourWindows();

    const next = activateNumber(state, 2);

    expect(next.activeId).toBe(at(state, 1).id);
    expect(at(next, 1)).toStrictEqual({ ...at(state, 1), unread: 0, highlight: false });
  });

  it('leaves the state alone for a number that names no window', () => {
    const state = fourWindows();

    expect(activateNumber(state, 0)).toBe(state);
    expect(activateNumber(state, 5)).toBe(state);
    expect(activateNumber(state, 1.5)).toBe(state);
  });
});

describe(activateNext, () => {
  it('activates the window after the active one and acknowledges it', () => {
    const state = active(fourWindows(), STATUS_WINDOW_ID);

    const next = activateNext(state);

    expect(next.activeId).toBe(at(state, 1).id);
    expect(at(next, 1)).toStrictEqual({ ...at(state, 1), unread: 0, highlight: false });
  });

  it('wraps from the last window to the status window', () => {
    const state = fourWindows();

    expect(activateNext(state).activeId).toBe(STATUS_WINDOW_ID);
  });

  it('has nowhere to go when the state holds only the status window', () => {
    const state = initialWindowsState();

    expect(activateNext(state)).toBe(state);
  });
});

describe(activatePrevious, () => {
  it('wraps from the status window to the last one', () => {
    const state = active(fourWindows(), STATUS_WINDOW_ID);

    expect(activatePrevious(state).activeId).toBe(at(state, 3).id);
  });

  it('activates the window before the active one and acknowledges it', () => {
    const state = active(fourWindows(), at(fourWindows(), 2).id);

    const next = activatePrevious(state);

    expect(next.activeId).toBe(at(state, 1).id);
    expect(at(next, 1)).toStrictEqual({ ...at(state, 1), unread: 0, highlight: false });
  });

  it('has nowhere to go when the state holds only the status window', () => {
    const state = initialWindowsState();

    expect(activatePrevious(state)).toBe(state);
  });
});

describe(moveWindow, () => {
  it('moves a window to the given position, shifting the others', () => {
    const state = fourWindows();

    const next = moveWindow(state, at(state, 3).id, 2);

    expect(ids(next)).toStrictEqual([
      STATUS_WINDOW_ID,
      at(state, 3).id,
      at(state, 1).id,
      at(state, 2).id,
    ]);
  });

  it('does not change which window is active', () => {
    const state = fourWindows();
    const home = at(state, 1);

    const next = moveWindow(active(state, home.id), home.id, 4);

    expect(next.activeId).toBe(home.id);
    expect(at(next, 3)).toBe(home);
  });

  it('refuses to move the status window or to settle for position 1', () => {
    const state = fourWindows();

    expect(moveWindow(state, STATUS_WINDOW_ID, 3)).toBe(state);
    expect(moveWindow(state, at(state, 1).id, 1)).toBe(state);
  });

  it('refuses a position beyond the list or not a whole number', () => {
    const state = fourWindows();
    const dm = at(state, 3);

    expect(moveWindow(state, dm.id, 5)).toBe(state);
    expect(moveWindow(state, dm.id, 2.5)).toBe(state);
  });

  it('refuses an id no window has', () => {
    const state = fourWindows();

    expect(moveWindow(state, 'nope:nope:nope', 2)).toBe(state);
  });
});

describe('navigation', () => {
  it('never mutates the state it is given', () => {
    const state = deepFreeze(fourWindows());
    const before = structuredClone(state);

    activateNumber(state, 2);
    activateNext(state);
    activatePrevious(state);
    moveWindow(state, at(state, 3).id, 2);

    expect(state).toStrictEqual(before);
    expect(state.windows).toHaveLength(4);
  });
});

describe(windowsReducer, () => {
  it('activateNumber runs the navigation by number', () => {
    const state = fourWindows();

    const next = windowsReducer(state, { type: 'activateNumber', number: 3 });

    expect(next.activeId).toBe(at(state, 2).id);
  });

  it('next steps one window along the list', () => {
    const state = fourWindows();

    expect(windowsReducer(state, { type: 'next' }).activeId).toBe(STATUS_WINDOW_ID);
  });

  it('previous steps one window back along the list', () => {
    const state = active(fourWindows(), STATUS_WINDOW_ID);

    expect(windowsReducer(state, { type: 'previous' }).activeId).toBe(at(state, 3).id);
  });

  it('move shifts a window to its new position', () => {
    const state = fourWindows();

    const next = windowsReducer(state, { type: 'move', id: at(state, 3).id, toNumber: 2 });

    expect(ids(next)).toStrictEqual([
      STATUS_WINDOW_ID,
      at(state, 3).id,
      at(state, 1).id,
      at(state, 2).id,
    ]);
  });
});
