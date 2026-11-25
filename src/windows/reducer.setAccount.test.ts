/**
 * Tests for the `setAccount` window action: the window it names is pointed at
 * another account while keeping its id, its place in the list and which window
 * is active; the account it already has, or a window nobody has, changes
 * nothing.
 */
import { describe, expect, it } from 'vitest';

import { initialWindowsState } from './model';
import type { WindowsState } from './model';
import { windowsReducer } from './reducer';

/** Window 1 plus a composer of lain's (the active one) and a home of bob's. */
function twoOpen(): WindowsState {
  const composer = windowsReducer(initialWindowsState(), {
    type: 'open',
    ref: { kind: 'composer', accountKey: 'lain', target: '1' },
    title: 'compose',
  });
  return windowsReducer(composer, {
    type: 'open',
    ref: { kind: 'home', accountKey: 'bob', target: null },
    title: 'home',
  });
}

describe('setAccount', () => {
  it('points the window at another account and keeps its id, place and the active window', () => {
    const state = twoOpen();
    const composer = state.windows[1];

    const next = windowsReducer(state, {
      type: 'setAccount',
      id: 'composer:lain:1',
      accountKey: 'bob',
    });

    expect(next.windows[1]).toStrictEqual({
      ...composer,
      ref: { kind: 'composer', accountKey: 'bob', target: '1' },
    });
    expect(next.windows[2]).toBe(state.windows[2]);
    expect(next.activeId).toBe(state.activeId);
  });

  it('changes nothing for the account the window has', () => {
    const state = twoOpen();

    expect(
      windowsReducer(state, { type: 'setAccount', id: 'composer:lain:1', accountKey: 'lain' }),
    ).toBe(state);
  });

  it('changes nothing for a window nobody has', () => {
    const state = twoOpen();

    expect(
      windowsReducer(state, { type: 'setAccount', id: 'nope:nope:nope', accountKey: 'bob' }),
    ).toBe(state);
  });
});
