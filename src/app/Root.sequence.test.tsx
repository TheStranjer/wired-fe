/**
 * Tests for key sequences in the shell (decision 18): the first chord of a
 * bound sequence shows as the pending prefix in the status line next to the
 * mode, and finishing the sequence, cancelling it or losing window focus
 * clears it. The sequence is the reader's own override, as `/bind` stores it.
 * Startup is mocked; it has its own tests.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import { DEFAULT_SETTINGS } from '../state/settings';
import { AppStateProvider } from '../state/StateContext';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render the shell in navigation mode with `Ctrl+b v` bound to /help. */
function renderNavigation(): void {
  const settings = {
    ...DEFAULT_SETTINGS,
    keyOverrides: [{ mode: 'navigation', chord: 'Ctrl+b v', line: '/help' }],
  } as const;
  render(
    <AppStateProvider initial={{ ...initialAppState(settings), mode: 'navigation' }}>
      <Root />
    </AppStateProvider>,
  );
}

describe('key sequences in the shell', () => {
  it('shows the pending prefix beside the mode and clears it when the sequence completes', () => {
    renderNavigation();

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    expect(screen.getByText('[Ctrl+b …]')).toBeInTheDocument();
    expect(screen.getByText('[NAV]')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'v' });

    expect(screen.queryByText('[Ctrl+b …]')).toBeNull();
  });

  it('clears the prefix on Escape and stays in navigation mode', () => {
    renderNavigation();
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText('[Ctrl+b …]')).toBeNull();
    expect(screen.getByText('[NAV]')).toBeInTheDocument();
  });

  it('clears the prefix when the window loses focus', () => {
    renderNavigation();
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    act(() => {
      fireEvent.blur(window);
    });

    expect(screen.queryByText('[Ctrl+b …]')).toBeNull();
  });
});
