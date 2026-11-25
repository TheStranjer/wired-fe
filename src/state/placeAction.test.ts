/**
 * Tests for the `openPlaced` action through the application's one reducer
 * (decision 13): the window is opened and shown as the placement says, it
 * gets its own scrollback however it is placed, and asking again for a
 * window that is open and hidden changes nothing at all.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import type { OpenAction } from './placement';
import { appReducer } from './reducer';
import { activeDesktop } from '../windows/desktops';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';

/** The ask to open the #rust window. */
const RUST: OpenAction = {
  type: 'open',
  ref: { kind: 'hashtag', accountKey: 'a#1', target: 'rust' },
  title: '#rust',
};

/** The id of the #rust window. */
const RUST_ID = windowId(RUST.ref);

describe('the openPlaced action', () => {
  it('opens the window in a float and makes it the active, focused one', () => {
    const state = appReducer(initialAppState(), {
      type: 'openPlaced',
      action: RUST,
      placement: 'float',
    });

    expect(state.windows.activeId).toBe(RUST_ID);
    expect(activeDesktop(state.layout).floats.map((float) => float.windowId)).toStrictEqual([
      RUST_ID,
    ]);
  });

  it('gives a hidden window its own empty scrollback and leaves the shown one active', () => {
    const state = appReducer(initialAppState(), {
      type: 'openPlaced',
      action: RUST,
      placement: 'hidden',
    });

    expect(state.windows.activeId).toBe(STATUS_WINDOW_ID);
    expect(state.buffers.has(RUST_ID)).toBe(true);
  });

  it('hands back the very same state when a hidden window is asked for again', () => {
    const hidden = appReducer(initialAppState(), {
      type: 'openPlaced',
      action: RUST,
      placement: 'hidden',
    });

    expect(appReducer(hidden, { type: 'openPlaced', action: RUST, placement: 'hidden' })).toBe(
      hidden,
    );
  });
});
