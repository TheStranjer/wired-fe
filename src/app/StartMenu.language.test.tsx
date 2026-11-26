/**
 * Tests for the start menu's language entry (WFE-310): its last row `Language…`
 * runs `/lang --pick`; while the language list is open it takes the views'
 * place, a language row runs `/lang <code>` and closes the menu, and the
 * button and Esc close it like the views.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StartMenu } from './StartMenu';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';
import { PostActionsProvider } from '../views/PostActionsContext';

/** The state with the start menu open, or the language list when asked. */
function stateWith(languages: boolean): AppState {
  return languages
    ? appReducer(initialAppState(), { type: 'languageMenu', open: true })
    : appReducer(initialAppState(), { type: 'startMenu', open: true });
}

/** Draws the menu over {@link initial} and answers the spy the rows run through. */
function show(initial: AppState): (line: PostActionLine) => void {
  const run = vi.fn<(line: PostActionLine) => void>();
  render(
    <AppStateProvider initial={initial}>
      <PostActionsProvider actions={{ linesFor: () => ({}), run }}>
        <StartMenu />
      </PostActionsProvider>
    </AppStateProvider>,
  );
  return run;
}

/** The menu's button. */
function button(): HTMLElement {
  return screen.getByRole('button', { name: '[≡ wired] start menu' });
}

describe('the start menu languages', () => {
  it('ends the views with a Language… row that runs /lang --pick and closes the menu', () => {
    const run = show(stateWith(false));

    const rows = screen.getAllByRole('button').map((one) => one.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Language…' }));

    expect(rows.at(-1)).toBe('Language…');
    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/lang --pick', prefill: false });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('shows the languages instead of the views while the language list is open', () => {
    show(stateWith(true));

    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('toolbar', { name: 'Choose the interface language' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English English' })).toHaveFocus();
  });

  it('runs /lang <code> for a language and closes the menu', () => {
    const run = show(stateWith(true));

    fireEvent.click(screen.getByRole('button', { name: 'Deutsch German' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/lang de', prefill: false });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the language list on a click of the button', () => {
    show(stateWith(true));

    fireEvent.click(button());

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the language list on Esc and hands focus back to the button', () => {
    show(stateWith(true));

    fireEvent.keyDown(screen.getByRole('button', { name: 'Deutsch German' }), { key: 'Escape' });

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it('opens the views, not the languages, from the closed button', () => {
    show(initialAppState());

    fireEvent.click(button());

    expect(screen.getByRole('toolbar', { name: 'Open a view as a float' })).toBeVisible();
  });
});
