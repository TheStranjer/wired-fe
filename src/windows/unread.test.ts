/**
 * Unread tracking: accumulating lines on inactive windows, the sticky
 * highlight, reading a window clear, and the sum over every window; plus the
 * reducer handing its two unread actions to these functions.
 */
import { describe, expect, it } from 'vitest';

import { initialWindowsState, windowId } from './model';
import type { WindowKind, WindowRef, WindowsState, WindowState } from './model';
import { windowsReducer } from './reducer';
import { markRead, markUnread, totalUnread } from './unread';

const ACCOUNT = 'lain@wired.example';
const DM_TARGET = '@a3@wired.example';

/** A view on an account, with no target unless one is given. */
function ref(kind: WindowKind, target: string | null = null): WindowRef {
  return { kind, accountKey: ACCOUNT, target };
}

/** The window `ref` names for a view, carrying the given unread state. */
function windowFor(view: WindowRef, unread = 0, highlight = false): WindowState {
  return { id: windowId(view), ref: view, title: view.kind, unread, highlight, display: {} };
}

/** Status, a home window with two unread lines, and an active, clean dm. */
function threeWindows(): WindowsState {
  const status = windowFor({ kind: 'status', accountKey: null, target: null });
  const dm = windowFor(ref('dm', DM_TARGET));
  return { windows: [status, windowFor(ref('home'), 2), dm], activeId: dm.id };
}

/** The window at a position in a list the test built itself. */
function at(state: WindowsState, index: number): WindowState {
  const win = state.windows.at(index);
  if (win === undefined) {
    throw new Error(`no window at position ${String(index)}`);
  }
  return win;
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

describe(markUnread, () => {
  it('adds the count to an inactive window and leaves the other windows alone', () => {
    const state = threeWindows();
    const home = at(state, 1);

    const next = markUnread(state, home.id, 3, false);

    expect(at(next, 1)).toStrictEqual({ ...home, unread: 5 });
    expect(next.activeId).toBe(state.activeId);
    expect(at(next, 0)).toBe(at(state, 0));
    expect(at(next, 2)).toBe(at(state, 2));
  });

  it('accumulates over repeated marks', () => {
    const state = threeWindows();
    const home = at(state, 1);

    const twice = markUnread(markUnread(state, home.id, 3, false), home.id, 4, false);

    expect(at(twice, 1).unread).toBe(9);
  });

  it('sets a highlight and keeps one the window already had', () => {
    const state = threeWindows();
    const home = at(state, 1);

    const lit = markUnread(state, home.id, 1, true);
    const dim = markUnread(lit, home.id, 1, false);

    expect(at(lit, 1).highlight).toBe(true);
    expect(at(dim, 1)).toStrictEqual({ ...home, unread: 4, highlight: true });
  });

  it('leaves the state alone for the active window', () => {
    const state = threeWindows();

    expect(markUnread(state, state.activeId, 5, true)).toBe(state);
  });

  it('leaves the state alone for an id no window has', () => {
    const state = threeWindows();

    expect(markUnread(state, 'nope:nope:nope', 2, true)).toBe(state);
  });

  it('ignores counts that are negative or not whole', () => {
    const state = threeWindows();
    const home = at(state, 1);

    expect(markUnread(state, home.id, -1, false)).toBe(state);
    expect(markUnread(state, home.id, 1.5, false)).toBe(state);
    expect(markUnread(state, home.id, Number.NaN, true)).toBe(state);
  });

  it('leaves the state alone when a mark would change nothing', () => {
    const state = threeWindows();
    const home = at(state, 1);
    const lit = markUnread(state, home.id, 1, true);

    expect(markUnread(state, home.id, 0, false)).toBe(state);
    expect(markUnread(lit, home.id, 0, true)).toBe(lit);
    expect(markUnread(lit, home.id, 0, false)).toBe(lit);
  });

  it('never mutates the state it is given', () => {
    const state = deepFreeze(threeWindows());
    const before = structuredClone(state);

    markUnread(state, at(state, 1).id, 3, true);

    expect(state).toStrictEqual(before);
  });
});

describe(markRead, () => {
  it('clears the count and the highlight of a window', () => {
    const state = threeWindows();
    const home = at(state, 1);
    const lit = markUnread(state, home.id, 1, true);

    const next = markRead(lit, home.id);

    expect(at(next, 1)).toStrictEqual({ ...home, unread: 0, highlight: false });
    expect(next.activeId).toBe(lit.activeId);
    expect(at(next, 0)).toBe(at(state, 0));
    expect(at(next, 2)).toBe(at(state, 2));
  });

  it('leaves an already clear window alone', () => {
    const state = threeWindows();

    expect(markRead(state, state.activeId)).toBe(state);
  });

  it('leaves the state alone for an id no window has', () => {
    const state = threeWindows();

    expect(markRead(state, 'nope:nope:nope')).toBe(state);
  });

  it('never mutates the state it is given', () => {
    const state = deepFreeze(threeWindows());
    const before = structuredClone(state);

    markRead(state, at(state, 1).id);

    expect(state).toStrictEqual(before);
  });
});

describe(totalUnread, () => {
  it('sums the unread counts of every window', () => {
    const state = threeWindows();

    expect(totalUnread(markUnread(state, at(state, 1).id, 3, false))).toBe(5);
  });

  it('is zero when no window has anything unread', () => {
    expect(totalUnread(initialWindowsState())).toBe(0);
    expect(totalUnread(threeWindows())).toBe(2);
  });
});

describe('the unread actions in the reducer', () => {
  it('delegates markUnread', () => {
    const state = threeWindows();
    const home = at(state, 1);

    expect(
      windowsReducer(state, { type: 'markUnread', id: home.id, count: 4, highlight: true }),
    ).toStrictEqual(markUnread(state, home.id, 4, true));
    expect(
      windowsReducer(state, { type: 'markUnread', id: state.activeId, count: 2, highlight: true }),
    ).toBe(state);
  });

  it('delegates markRead', () => {
    const state = threeWindows();
    const home = at(state, 1);

    expect(windowsReducer(state, { type: 'markRead', id: home.id })).toStrictEqual(
      markRead(state, home.id),
    );
    expect(windowsReducer(state, { type: 'markRead', id: state.activeId })).toBe(state);
  });
});
