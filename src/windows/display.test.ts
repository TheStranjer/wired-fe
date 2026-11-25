/**
 * Tests for the `setDisplay` window action (decision 15): overrides merge into
 * a window's own record, `undefined` clears a key back to inheriting, and a
 * request that changes nothing hands back the very same state.
 */
import { describe, expect, it } from 'vitest';

import type { WindowRef, WindowsState } from './model';
import { initialWindowsState, windowId } from './model';
import { windowsReducer } from './reducer';

const HOME: WindowRef = { kind: 'home', accountKey: 'lain@wired.example', target: null };
const HOME_ID = windowId(HOME);

/** Status and home windows, home active, neither overriding anything. */
function twoWindows(): WindowsState {
  return windowsReducer(initialWindowsState(), { type: 'open', ref: HOME, title: 'home' });
}

/** The overrides of one window of {@link state}. */
function displayOf(state: WindowsState, id: string): unknown {
  return state.windows.find((win) => win.id === id)?.display;
}

describe('setDisplay', () => {
  it('starts every window without overrides', () => {
    expect(displayOf(twoWindows(), HOME_ID)).toStrictEqual({});
    expect(displayOf(twoWindows(), 'status')).toStrictEqual({});
  });

  it('sets one key and leaves the other windows alone', () => {
    const next = windowsReducer(twoWindows(), {
      type: 'setDisplay',
      id: HOME_ID,
      overrides: { density: 'lines' },
    });

    expect(displayOf(next, HOME_ID)).toStrictEqual({ density: 'lines' });
    expect(displayOf(next, 'status')).toStrictEqual({});
  });

  it('merges new keys into the ones already set', () => {
    const once = windowsReducer(twoWindows(), {
      type: 'setDisplay',
      id: HOME_ID,
      overrides: { density: 'lines', images: false },
    });
    const twice = windowsReducer(once, {
      type: 'setDisplay',
      id: HOME_ID,
      overrides: { avatars: false, images: true },
    });

    expect(displayOf(twice, HOME_ID)).toStrictEqual({
      density: 'lines',
      avatars: false,
      images: true,
    });
  });

  it('clears a key set to undefined and keeps the rest', () => {
    const set = windowsReducer(twoWindows(), {
      type: 'setDisplay',
      id: HOME_ID,
      overrides: { density: 'lines', avatars: false },
    });
    const cleared = windowsReducer(set, {
      type: 'setDisplay',
      id: HOME_ID,
      overrides: { density: undefined },
    });

    expect(displayOf(cleared, HOME_ID)).toStrictEqual({ avatars: false });
  });

  it('keeps a key the change does not mention', () => {
    const set = windowsReducer(twoWindows(), {
      type: 'setDisplay',
      id: HOME_ID,
      overrides: { images: false },
    });

    const next = windowsReducer(set, { type: 'setDisplay', id: HOME_ID, overrides: {} });

    expect(next).toBe(set);
  });

  it('hands back the same state when the change alters nothing', () => {
    const state = twoWindows();

    expect(
      windowsReducer(state, { type: 'setDisplay', id: HOME_ID, overrides: { avatars: undefined } }),
    ).toBe(state);
  });

  it('hands back the same state for a window that does not exist', () => {
    const state = twoWindows();

    expect(
      windowsReducer(state, { type: 'setDisplay', id: 'nope', overrides: { images: false } }),
    ).toBe(state);
  });
});
