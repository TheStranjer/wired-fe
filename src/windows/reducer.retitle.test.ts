/**
 * Tests for the `retitle` window action: the window it names takes the new
 * title and keeps its id, place and the active window; an unknown window or the
 * title it already has changes nothing.
 */
import { describe, expect, it } from 'vitest';

import { initialWindowsState } from './model';
import { windowsReducer } from './reducer';

/** Window 1 plus a feed window titled `~main`, active. */
function withFeed(): ReturnType<typeof initialWindowsState> {
  return windowsReducer(initialWindowsState(), {
    type: 'open',
    ref: { kind: 'feed', accountKey: null, target: 'f1' },
    title: '~main',
  });
}

describe('retitle', () => {
  it('gives the window the new title and keeps its id and the active window', () => {
    const state = withFeed();

    const next = windowsReducer(state, { type: 'retitle', id: 'feed:-:f1', title: '~prime' });

    expect(next.windows.map((win) => win.title)).toStrictEqual(['status', '~prime']);
    expect(next.windows[1]?.id).toBe('feed:-:f1');
    expect(next.activeId).toBe(state.activeId);
  });

  it('changes nothing for a window nobody has or the title it already has', () => {
    const state = withFeed();

    expect(windowsReducer(state, { type: 'retitle', id: 'nope', title: 'x' })).toBe(state);
    expect(windowsReducer(state, { type: 'retitle', id: 'feed:-:f1', title: '~main' })).toBe(state);
  });
});
