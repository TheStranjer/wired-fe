/**
 * Tests for the status window kind: the definition it self-registers, the topic
 * line it shows in the TopicBar, that posting is not possible in it, and that
 * its component renders the status buffer's lines through the shared scrollback.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider } from '../../state/StateContext';
import { STATUS_WINDOW_ID, activeWindow } from '../../windows/model';

/** A moment whose clock reads the same in every timezone: local 23:04. */
const DATE = new Date(2026, 0, 2, 23, 4);

/** The window the definition is asked about: window 1, as the state holds it. */
const STATUS_WINDOW = activeWindow(initialAppState().windows);

/** The default state with these client messages printed into window 1. */
function seeded(texts: readonly string[]): AppState {
  return texts.reduce(
    (state, text) =>
      appReducer(state, {
        type: 'print',
        windowId: STATUS_WINDOW_ID,
        date: DATE,
        level: 'info',
        text,
      }),
    initialAppState(),
  );
}

/** Show the kind's component over the state {@link state}. */
function renderStatus(state: AppState) {
  const { Component } = windowKind;
  return render(
    <AppStateProvider initial={state}>
      <Component windowId={STATUS_WINDOW_ID} />
    </AppStateProvider>,
  );
}

describe('the status window kind', () => {
  it('is the definition for the status kind, with no way to post', () => {
    expect(windowKind.kind).toBe('status');
    expect(windowKind.onPost).toBeUndefined();
  });

  it('topics the app name and the moment, not the window', () => {
    // The example config names the app WIRED (see src/config/config.test.ts).
    expect(windowKind.topic(STATUS_WINDOW, initialAppState())).toBe(
      'WIRED — Present day. Present time.',
    );
  });

  it('renders the status buffer lines in order in a status log region', () => {
    renderStatus(seeded(['not connected', 'try /connect']));

    const log = screen.getByRole('log', { name: 'status' });

    expect(Array.from(log.children, (line) => line.textContent)).toStrictEqual([
      '23:04 *** not connected',
      '23:04 *** try /connect',
    ]);
  });

  it('renders an empty region when the status buffer holds nothing', () => {
    renderStatus(initialAppState());

    expect(screen.getByRole('log', { name: 'status' })).toBeEmptyDOMElement();
  });
});
