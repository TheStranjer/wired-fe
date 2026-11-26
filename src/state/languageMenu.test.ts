/**
 * Tests for the language list's state (WFE-310): the action opens and closes
 * it, and a state already as asked comes back as it was.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import { appReducer } from './reducer';

describe('the language list state', () => {
  it('starts closed', () => {
    expect(initialAppState().languageMenu).toBe(false);
  });

  it('opens and closes on the languageMenu action', () => {
    const opened = appReducer(initialAppState(), { type: 'languageMenu', open: true });

    expect(opened.languageMenu).toBe(true);
    expect(appReducer(opened, { type: 'languageMenu', open: false }).languageMenu).toBe(false);
  });

  it('returns the same state when it already is as asked', () => {
    const closed = initialAppState();
    const opened = appReducer(closed, { type: 'languageMenu', open: true });

    expect(appReducer(closed, { type: 'languageMenu', open: false })).toBe(closed);
    expect(appReducer(opened, { type: 'languageMenu', open: true })).toBe(opened);
  });
});
