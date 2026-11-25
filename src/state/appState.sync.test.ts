/**
 * The app reducer keeps windows and panes in step: window commands move focus
 * between panes, layout actions move the active window, closing a window
 * closes its panes, and a window on screen is not counted unread.
 */
import { describe, expect, it } from 'vitest';

import { type AppState, initialAppState } from './appState';
import { type AppAction, appReducer } from './reducer';
import { activeDesktop, focusedPane } from './selectors';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const HOME: WindowRef = { kind: 'home', accountKey: 'k', target: null };
const HOME_ID = windowId(HOME);

/** The actions run in order from the initial state. */
function run(...actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

/** Home beside status, side by side, with status (the new pane) focused. */
function twoPanes(): AppState {
  return run(
    { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
    { type: 'layout', action: { type: 'split', dir: 'row', windowId: STATUS_WINDOW_ID } },
  );
}

describe('the app reducer with two panes', () => {
  it('splitting makes the new pane active', () => {
    const state = twoPanes();

    expect(focusedPane(state)?.windowId).toBe(STATUS_WINDOW_ID);
    expect(state.windows.activeId).toBe(STATUS_WINDOW_ID);
  });

  it('/win N focuses the pane that already shows that window', () => {
    const state = appReducer(twoPanes(), {
      type: 'windows',
      action: { type: 'activateNumber', number: 2 },
    });

    expect(activeDesktop(state).focusedPaneId).toBe('p1');
    expect(state.windows.activeId).toBe(HOME_ID);
    expect(focusedPane(state)?.windowId).toBe(HOME_ID);
  });

  it('focusing a pane makes its window the active one', () => {
    const state = appReducer(twoPanes(), {
      type: 'layout',
      action: { type: 'focusPane', paneId: 'p1' },
    });

    expect(state.windows.activeId).toBe(HOME_ID);
  });

  it('closing a window closes its pane', () => {
    const state = appReducer(twoPanes(), {
      type: 'windows',
      action: { type: 'close', id: HOME_ID },
    });

    expect(activeDesktop(state).tree).toStrictEqual({
      type: 'pane',
      paneId: 'p2',
      windowId: STATUS_WINDOW_ID,
    });
    expect(state.buffers.has(HOME_ID)).toBe(false);
  });

  it('hands back the very same state when a window action changes nothing', () => {
    const before = twoPanes();

    expect(appReducer(before, { type: 'windows', action: { type: 'close', id: 'nothing' } })).toBe(
      before,
    );
  });
});
