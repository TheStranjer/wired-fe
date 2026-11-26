/**
 * Tests for the start menu's state (WFE-299): the action opens and closes it,
 * and a state already as asked comes back as it was.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import { appReducer } from './reducer';

describe('the start menu state', () => {
  it('starts closed', () => {
    expect(initialAppState().startMenu).toBe(false);
  });

  it('opens and closes on the startMenu action', () => {
    const opened = appReducer(initialAppState(), { type: 'startMenu', open: true });

    expect(opened.startMenu).toBe(true);
    expect(appReducer(opened, { type: 'startMenu', open: false }).startMenu).toBe(false);
  });

  it('returns the same state when it already is as asked', () => {
    const closed = initialAppState();
    const opened = appReducer(closed, { type: 'startMenu', open: true });

    expect(appReducer(closed, { type: 'startMenu', open: false })).toBe(closed);
    expect(appReducer(opened, { type: 'startMenu', open: true })).toBe(opened);
  });
});
