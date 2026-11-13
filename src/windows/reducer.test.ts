/**
 * The window reducer: opening a view, closing a window, activating one, and
 * the promise that no action mutates the state it was handed.
 */
import { describe, expect, it } from 'vitest';

import { initialWindowsState, STATUS_WINDOW_ID, windowId } from './model';
import type { WindowKind, WindowRef, WindowsState, WindowState } from './model';
import { windowsReducer } from './reducer';
import type { WindowsAction } from './reducer';

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

/** Status, a home window with two unread and a highlight, and an active dm. */
function threeWindows(): WindowsState {
  const status = windowFor(ref('status', null, null));
  const home = { ...windowFor(ref('home'), '@lain home'), unread: 2, highlight: true };
  const dm = windowFor(ref('dm', DM_TARGET), 'dm @a3');
  return { windows: [status, home, dm], activeId: dm.id };
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

/** Every action, each one hitting a real window or a name that matches none. */
function everyAction(state: WindowsState): readonly WindowsAction[] {
  const home = at(state, 1);
  return [
    { type: 'open', ref: ref('profile', '7'), title: '@lain profile' },
    { type: 'open', ref: home.ref, title: 'a different title' },
    { type: 'close', id: home.id },
    { type: 'close', id: 'nope:nope:nope' },
    { type: 'close', id: STATUS_WINDOW_ID },
    { type: 'activate', id: home.id },
    { type: 'activate', id: 'nope:nope:nope' },
  ];
}

describe('open', () => {
  it('appends a window for a view nothing shows yet, and activates it', () => {
    const home = ref('home');

    const next = windowsReducer(initialWindowsState(), {
      type: 'open',
      ref: home,
      title: '@lain home',
    });

    expect(next.windows).toHaveLength(2);
    expect(at(next, 1)).toStrictEqual({
      id: windowId(home),
      ref: home,
      title: '@lain home',
      unread: 0,
      highlight: false,
    });
    expect(next.activeId).toBe(windowId(home));
  });

  it('activates the window that already shows a view instead of adding one', () => {
    const dm = ref('dm', DM_TARGET);
    const opened = windowsReducer(initialWindowsState(), {
      type: 'open',
      ref: dm,
      title: 'dm @a3',
    });

    const next = windowsReducer(opened, { type: 'open', ref: dm, title: 'a different title' });

    expect(next.windows).toHaveLength(2);
    expect(at(next, 1).title).toBe('dm @a3');
    expect(next.activeId).toBe(windowId(dm));
  });

  it('clears the unread count and highlight of the window it brings back', () => {
    const state = threeWindows();
    const home = at(state, 1);

    const next = windowsReducer(state, { type: 'open', ref: home.ref, title: 'other title' });

    expect(next.activeId).toBe(home.id);
    expect(at(next, 1)).toStrictEqual({ ...home, unread: 0, highlight: false });
  });

  it('finds the status window rather than opening a second one', () => {
    const state = threeWindows();

    const next = windowsReducer(state, { type: 'open', ref: at(state, 0).ref, title: 'x' });

    expect(next.windows).toHaveLength(3);
    expect(next.activeId).toBe(STATUS_WINDOW_ID);
    expect(at(next, 0)).toBe(at(state, 0));
  });
});

describe('close', () => {
  it('leaves the state alone when asked to close the status window', () => {
    const state = threeWindows();

    expect(windowsReducer(state, { type: 'close', id: STATUS_WINDOW_ID })).toBe(state);
  });

  it('leaves the state alone for an id no window has', () => {
    const state = threeWindows();

    expect(windowsReducer(state, { type: 'close', id: 'nope:nope:nope' })).toBe(state);
  });

  it('keeps the active window when it closes a different one', () => {
    const state = threeWindows();

    const next = windowsReducer(state, { type: 'close', id: at(state, 1).id });

    expect(next.windows.map((win) => win.id)).toStrictEqual([STATUS_WINDOW_ID, at(state, 2).id]);
    expect(next.activeId).toBe(state.activeId);
    expect(at(next, 1)).toBe(at(state, 2));
  });

  it('activates the window before the one it closes', () => {
    const state = threeWindows();

    const next = windowsReducer(state, { type: 'close', id: at(state, 2).id });

    expect(next.windows).toHaveLength(2);
    expect(next.activeId).toBe(at(state, 1).id);
  });

  it('falls back to the status window when it closes the only other one', () => {
    const home = ref('home');
    const opened = windowsReducer(initialWindowsState(), {
      type: 'open',
      ref: home,
      title: 'home',
    });

    const next = windowsReducer(opened, { type: 'close', id: windowId(home) });

    expect(next.windows).toHaveLength(1);
    expect(next.activeId).toBe(STATUS_WINDOW_ID);
  });
});

describe('activate', () => {
  it('leaves the state alone for an id no window has', () => {
    const state = threeWindows();

    expect(windowsReducer(state, { type: 'activate', id: 'nope:nope:nope' })).toBe(state);
  });

  it('activates a window and clears its unread count and highlight', () => {
    const state = threeWindows();

    const next = windowsReducer(state, { type: 'activate', id: at(state, 1).id });

    expect(next.activeId).toBe(at(state, 1).id);
    expect(at(next, 1)).toStrictEqual({ ...at(state, 1), unread: 0, highlight: false });
    expect(at(next, 1)).not.toBe(at(state, 1));
    expect(at(next, 0)).toBe(at(state, 0));
    expect(at(next, 2)).toBe(at(state, 2));
  });

  it('keeps an already clean window as it was', () => {
    const state = threeWindows();

    const next = windowsReducer(state, { type: 'activate', id: at(state, 2).id });

    expect(next.windows).toHaveLength(3);
    expect(at(next, 2)).toBe(at(state, 2));
    expect(at(next, 1)).toBe(at(state, 1));
  });
});

describe(windowsReducer, () => {
  it('never mutates the state it is given', () => {
    const state = deepFreeze(threeWindows());
    const before = structuredClone(state);

    for (const action of everyAction(state)) {
      windowsReducer(state, action);
    }

    expect(state).toStrictEqual(before);
    expect(state.windows).toHaveLength(3);
  });

  it('hands back the very same state for an action with nothing to do', () => {
    const state = deepFreeze(threeWindows());

    expect(windowsReducer(state, { type: 'close', id: STATUS_WINDOW_ID })).toBe(state);
    expect(windowsReducer(state, { type: 'activate', id: 'nope:nope:nope' })).toBe(state);
    expect(windowsReducer(state, { type: 'close', id: 'nope:nope:nope' })).toBe(state);
  });
});
