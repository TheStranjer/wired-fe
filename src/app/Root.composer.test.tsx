/**
 * Tests for opening and closing the composer overlay in the running shell
 * (WFE-125): `/compose` and its alias open the box filled with their
 * argument and clear the line, Ctrl+E moves the command line's own plain
 * text into the box — and leaves a command where it is, Escape closes it and
 * hands focus back without touching the mode, and the navigation c chord
 * opens it while typing inside stays the box's own. Startup is mocked; it
 * has its own tests. What the box posts is in Root.composer.post.test.tsx.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** A fresh session moved along by {@link actions}. */
function stateAfter(actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

/** The command line. */
function commandLine(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** The composer's post textarea. */
function postField(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Render Root over a session built from {@link actions}, focus on the line. */
function renderRoot(actions: readonly AppAction[] = []): HTMLElement {
  render(
    <AppStateProvider initial={stateAfter(actions)}>
      <Root />
    </AppStateProvider>,
  );
  const line = commandLine();
  act(() => {
    line.focus();
  });
  return line;
}

/** Type {@link text} at the command line and press Enter. */
function submit(text: string): void {
  const line = commandLine();
  fireEvent.change(line, { target: { value: text } });
  fireEvent.keyDown(line, { key: 'Enter' });
}

describe('opening the composer overlay', () => {
  it('opens on /compose with its argument, and the line clears', async () => {
    renderRoot();

    submit('/compose so much to say');

    const dialog = await screen.findByRole('dialog', { name: 'Compose' });

    expect(dialog).toBeInTheDocument();
    expect(postField()).toHaveValue('so much to say');

    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });
  });

  it('runs under its alias and opens empty without an argument', async () => {
    renderRoot();

    submit('/c');

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(postField()).toHaveValue('');
    expect(screen.getByText('0/500')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'local' })).toBeNull();
  });

  it('Ctrl+E moves the command line’s plain text into the composer', async () => {
    const line = renderRoot();

    fireEvent.change(line, { target: { value: 'a draft half typed' } });
    fireEvent.keyDown(line, { key: 'e', ctrlKey: true });

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(postField()).toHaveValue('a draft half typed');
    expect(line).toHaveValue('');
    expect(postField()).toHaveFocus();
  });

  it('Ctrl+E over a command opens the composer empty and leaves the line', async () => {
    const line = renderRoot();

    fireEvent.change(line, { target: { value: '/help' } });
    fireEvent.keyDown(line, { key: 'e', ctrlKey: true });

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(postField()).toHaveValue('');
    expect(line).toHaveValue('/help');
  });

  it('Escape closes the box and hands focus back to the command line', async () => {
    const line = renderRoot();

    submit('/compose farewell');
    const field = await screen.findByRole('textbox', { name: 'Post text' });

    expect(screen.getByText('[INS]')).toBeInTheDocument();

    fireEvent.keyDown(field, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    expect(line).toHaveFocus();
    expect(screen.getByText('[INS]')).toBeInTheDocument();
  });

  it('opens on the navigation c chord and keeps its keys', async () => {
    renderRoot();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'c' });

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(postField(), { key: 'i' });

    expect(screen.getByText('[NAV]')).toBeInTheDocument();
    expect(postField()).toHaveFocus();
  });
});
