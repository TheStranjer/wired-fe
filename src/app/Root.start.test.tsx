/**
 * Tests for the start menu in the shell (WFE-299, decisions 6 and 18): its
 * button sits at the left of the status line, and `Ctrl+B Space` in insert
 * mode and `w Space` in navigation mode open it through `/start`. Startup is
 * mocked; it has its own tests.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import type { InputModeState } from '../state/appState';
import { AppStateProvider } from '../state/StateContext';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render the shell in the keyboard {@link mode}. */
function renderIn(mode: InputModeState): void {
  render(
    <AppStateProvider initial={{ ...initialAppState(), mode }}>
      <Root />
    </AppStateProvider>,
  );
}

/** The start menu's button. */
function startButton(): HTMLElement {
  return screen.getByRole('button', { name: '[≡ wired] start menu' });
}

describe('the start menu in the shell', () => {
  it('has its button in the footer, closed', () => {
    renderIn('insert');

    expect(within(screen.getByRole('contentinfo')).getByText('[≡ wired]')).toBeInTheDocument();
    expect(startButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on Ctrl+B Space in insert mode', async () => {
    renderIn('insert');

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(window, { key: ' ' });

    await waitFor(() => {
      expect(startButton()).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('opens on w Space in navigation mode', async () => {
    renderIn('navigation');

    fireEvent.keyDown(window, { key: 'w' });
    fireEvent.keyDown(window, { key: ' ' });

    await waitFor(() => {
      expect(startButton()).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
