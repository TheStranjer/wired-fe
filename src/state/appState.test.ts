/**
 * Tests for the app state's window side: the state a session starts in, the
 * buffers following the window list as windows open and close, and the promise
 * that a reducer handed an action that changes nothing hands the same state back.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, type CoreAction, coreReducer, initialAppState } from './appState';
import { type Buffer, EMPTY_BUFFER, type LineLevel } from './buffer';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';

const ACCOUNT = 'lain@wired.example';

/** The moment every printed line in these tests carries. */
const DATE = new Date('2026-11-14T21:04:00Z');

/** The view of `kind` on the account under test, with a target when it needs one. */
function ref(kind: WindowKind, target: string | null = null): WindowRef {
  return { kind, accountKey: ACCOUNT, target };
}

/** The id of the window that shows `kind`. */
function viewId(kind: WindowKind, target: string | null = null): string {
  return windowId(ref(kind, target));
}

/** The buffer of a window, or the test fails rather than guess at one. */
function bufferOf(state: AppState, id: string): Buffer {
  const buffer = state.buffers.get(id);
  if (buffer === undefined) {
    throw new Error(`no buffer for window ${id}`);
  }
  return buffer;
}

/** The action that opens a view. */
function openView(kind: WindowKind, title: string = kind): CoreAction {
  return { type: 'windows', action: { type: 'open', ref: ref(kind), title } };
}

/** The action that closes the window showing `kind`. */
function closeView(kind: WindowKind): CoreAction {
  return { type: 'windows', action: { type: 'close', id: viewId(kind) } };
}

/** The action that prints one client message into the window `target`, or the active one. */
function printLine(text: string, target: string | null = null): CoreAction {
  const level: LineLevel = 'info';
  return { type: 'print', windowId: target, date: DATE, level, text };
}

/** Window 1 and a home window on the account under test, with home active. */
function withHome(): AppState {
  return coreReducer(initialAppState(), openView('home'));
}

describe(initialAppState, () => {
  it('starts at window 1, and that window has its scrollback', () => {
    const state = initialAppState();

    expect(state.windows.windows.map((win) => win.id)).toStrictEqual([STATUS_WINDOW_ID]);
    expect(state.windows.activeId).toBe(STATUS_WINDOW_ID);
    expect([...state.buffers.keys()]).toStrictEqual([STATUS_WINDOW_ID]);
    expect(bufferOf(state, STATUS_WINDOW_ID)).toBe(EMPTY_BUFFER);
  });

  it('starts with nobody signed in and no instance read', () => {
    const state = initialAppState();

    expect(state.accounts).toStrictEqual([]);
    expect(state.activeAccountKey).toBeNull();
    expect(state.profiles.size).toBe(0);
  });

  it('starts in insert mode, on the defaults and at message zero', () => {
    const state = initialAppState();

    expect(state.mode).toBe('insert');
    expect(state.settings).toBe(DEFAULT_SETTINGS);
    expect(state.seq).toBe(0);
  });

  it('keeps the settings a caller has stored instead of the defaults', () => {
    const chosen: Settings = { ...DEFAULT_SETTINGS, effects: true, clockFormat: '12h' };

    expect(initialAppState(chosen).settings).toBe(chosen);
  });
});

describe('a window action', () => {
  it('gives a newly opened window a buffer of its own', () => {
    const next = coreReducer(initialAppState(), openView('home', '@lain home'));

    expect([...next.buffers.keys()]).toStrictEqual([STATUS_WINDOW_ID, viewId('home')]);
    expect(bufferOf(next, viewId('home'))).toBe(EMPTY_BUFFER);
  });

  it('drops the buffer of a window it closes, so reopening starts clean', () => {
    const opened = coreReducer(withHome(), printLine('hello from home', viewId('home')));

    const closed = coreReducer(opened, closeView('home'));

    expect(closed.buffers.has(viewId('home'))).toBe(false);
    expect(closed.buffers.has(STATUS_WINDOW_ID)).toBe(true);

    const reopened = coreReducer(closed, openView('home'));

    expect(bufferOf(reopened, viewId('home'))).toBe(EMPTY_BUFFER);
  });

  it('leaves the scrollback of a window that stays where it was', () => {
    const printed = coreReducer(withHome(), printLine('status line', STATUS_WINDOW_ID));
    const status = bufferOf(printed, STATUS_WINDOW_ID);

    const next = coreReducer(printed, closeView('home'));

    expect(bufferOf(next, STATUS_WINDOW_ID)).toBe(status);
    expect(next.seq).toBe(printed.seq);
  });

  it('hands back the very same state when the window list does not move', () => {
    const state = withHome();

    const next = coreReducer(state, {
      type: 'windows',
      action: { type: 'activate', id: 'nope:nope:nope' },
    });

    expect(next).toBe(state);
  });
});

describe(coreReducer, () => {
  it('never mutates the state it is given', () => {
    const state = structuredClone(withHome());
    const before = structuredClone(state);
    const actions: readonly CoreAction[] = [
      openView('dm', 'dm @a3'),
      closeView('home'),
      printLine('hello'),
      printLine('elsewhere', viewId('dm')),
      printLine('lost', 'nope:nope:nope'),
      { type: 'clear', windowId: STATUS_WINDOW_ID },
      { type: 'mode', mode: 'navigation' },
      { type: 'settings', settings: { effects: true } },
    ];

    for (const action of actions) {
      coreReducer(state, action);
    }

    expect(state).toStrictEqual(before);
  });
});
