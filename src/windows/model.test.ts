/**
 * The window model: the ids views are known by, the state a session starts
 * with, and finding a window by id or by number.
 */
import { describe, expect, it } from 'vitest';

import {
  activeWindow,
  initialWindowsState,
  STATUS_WINDOW_ID,
  windowId,
  windowNumber,
} from './model';
import type { WindowKind, WindowRef, WindowsState, WindowState } from './model';

const ACCOUNT = 'lain@wired.example';

/** A view on an account, with no target unless one is given. */
function ref(
  kind: WindowKind,
  target: string | null = null,
  accountKey: string | null = ACCOUNT,
): WindowRef {
  return { kind, accountKey, target };
}

/** A window list with these ids, in order, `active` being the last one. */
function stateWith(...ids: readonly string[]): WindowsState {
  const windows = ids.map((id): WindowState => ({
    id,
    ref: ref('thread', id),
    title: id,
    unread: 0,
    highlight: false,
  }));
  return { windows, activeId: ids.at(-1) ?? STATUS_WINDOW_ID };
}

describe(windowId, () => {
  it('names the status window after its kind alone', () => {
    expect(windowId(ref('status', null, null))).toBe(STATUS_WINDOW_ID);
  });

  it('names a dm after its account and its target', () => {
    expect(windowId(ref('dm', '@a3@wired.example'))).toBe(`dm:${ACCOUNT}:@a3@wired.example`);
  });

  it('spells an absent target as a dash', () => {
    expect(windowId(ref('dm', null))).toBe(`dm:${ACCOUNT}:-`);
  });

  it('spells an absent account as a dash', () => {
    expect(windowId(ref('hashtag', 'lain', null))).toBe('hashtag:-:lain');
  });

  it('gives the same view the same id every time', () => {
    const view = ref('profile', '9');

    expect(windowId(view)).toBe(windowId(ref('profile', '9')));
  });
});

describe(initialWindowsState, () => {
  it('holds only the status window, and has it active', () => {
    expect(initialWindowsState()).toStrictEqual({
      windows: [
        {
          id: STATUS_WINDOW_ID,
          ref: { kind: 'status', accountKey: null, target: null },
          title: STATUS_WINDOW_ID,
          unread: 0,
          highlight: false,
        },
      ],
      activeId: STATUS_WINDOW_ID,
    });
  });

  it('gives a fresh list to every call', () => {
    expect(initialWindowsState().windows).not.toBe(initialWindowsState().windows);
  });
});

describe(windowNumber, () => {
  it('numbers windows from 1, in list order', () => {
    const state = stateWith(STATUS_WINDOW_ID, `home:${ACCOUNT}:-`, `dm:${ACCOUNT}:@a3`);

    expect(windowNumber(state, STATUS_WINDOW_ID)).toBe(1);
    expect(windowNumber(state, `home:${ACCOUNT}:-`)).toBe(2);
    expect(windowNumber(state, `dm:${ACCOUNT}:@a3`)).toBe(3);
  });

  it('has no number for an unknown id', () => {
    expect(windowNumber(initialWindowsState(), 'thread:none')).toBeNull();
  });
});

describe(activeWindow, () => {
  it('returns the window the state calls active', () => {
    const state = stateWith(STATUS_WINDOW_ID, `home:${ACCOUNT}:-`);

    expect(activeWindow(state)).toBe(state.windows[1]);
  });

  it('falls back to the status window when the active id is unknown', () => {
    const state: WindowsState = { ...stateWith(STATUS_WINDOW_ID, 'home'), activeId: 'gone' };

    expect(activeWindow(state)).toBe(state.windows[0]);
  });

  it('falls back to the status window when there are no windows at all', () => {
    expect(activeWindow({ windows: [], activeId: 'gone' })).toStrictEqual({
      id: STATUS_WINDOW_ID,
      ref: { kind: 'status', accountKey: null, target: null },
      title: STATUS_WINDOW_ID,
      unread: 0,
      highlight: false,
    });
  });
});
