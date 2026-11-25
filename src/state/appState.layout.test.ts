/**
 * Tests for the app state's layout side: it starts as one desktop showing the
 * status window, `layout` actions route to the layout reducer, and the
 * desktop selectors read the result.
 */

import { describe, expect, it } from 'vitest';

import { coreReducer, initialAppState } from './appState';
import { activeDesktop, focusedPane } from './selectors';
import { STATUS_WINDOW_ID } from '../windows/model';

describe('the layout of the initial app state', () => {
  it('is one desktop with one focused pane showing the status window', () => {
    const state = initialAppState();

    expect(state.layout.desktops).toHaveLength(1);
    expect(focusedPane(state)).toStrictEqual({
      paneId: 'p1',
      windowId: STATUS_WINDOW_ID,
      rect: null,
    });
  });
});

describe('a layout action', () => {
  it('is routed to the layout reducer', () => {
    const state = coreReducer(initialAppState(), {
      type: 'layout',
      action: { type: 'split', dir: 'row', windowId: 'other' },
    });

    expect(activeDesktop(state).focusedPaneId).toBe('p2');
    expect(focusedPane(state)?.windowId).toBe('other');
  });

  it('leaves the windows and their scrollbacks alone', () => {
    const before = initialAppState();
    const after = coreReducer(before, { type: 'layout', action: { type: 'newDesktop' } });

    expect(after.windows).toBe(before.windows);
    expect(after.buffers).toBe(before.buffers);
  });

  it('hands back the very same state when the layout does not move', () => {
    const before = initialAppState();

    expect(coreReducer(before, { type: 'layout', action: { type: 'dock' } })).toBe(before);
  });
});

describe(activeDesktop, () => {
  it('is the desktop being shown', () => {
    const state = coreReducer(initialAppState(), {
      type: 'layout',
      action: { type: 'goToDesktop', n: 2 },
    });

    expect(activeDesktop(state).tree).toBeNull();
  });
});

describe(focusedPane, () => {
  it('is null on an empty desktop', () => {
    const state = coreReducer(initialAppState(), {
      type: 'layout',
      action: { type: 'newDesktop' },
    });

    expect(focusedPane(state)).toBeNull();
  });

  it('is the focused float, with its rectangle', () => {
    const state = coreReducer(initialAppState(), { type: 'layout', action: { type: 'float' } });

    expect(focusedPane(state)?.rect).not.toBeNull();
  });
});
