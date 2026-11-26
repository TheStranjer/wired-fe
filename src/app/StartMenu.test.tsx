/**
 * Tests for the start menu (WFE-299): the `[≡ wired]` button opens the shared
 * view list with the command `float`, a row runs `/float <view>` and closes the
 * menu, a row that asks opens the pane menus' dialog, and Esc or a click
 * outside closes it, Esc handing focus back to the button.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StartMenu } from './StartMenu';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';
import { PostActionsProvider } from '../views/PostActionsContext';

/** The state with the start menu closed, or open when asked. */
function stateWith(open: boolean): AppState {
  return appReducer(initialAppState(), { type: 'startMenu', open });
}

/** Draws the menu over {@link initial} and answers the spy the rows run through. */
function show(initial: AppState = stateWith(false)): (line: PostActionLine) => void {
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

/** The row called `name`. */
function row(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe(StartMenu, () => {
  it('shows a named, collapsed button and no list while closed', () => {
    show();

    expect(button()).toHaveTextContent('[≡ wired]');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('opens on a click, with focus on the first row, and closes on a second click', () => {
    show();

    fireEvent.click(button());

    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('toolbar', { name: 'Open a view as a float' })).toBeInTheDocument();
    expect(within(screen.getByRole('toolbar')).getAllByRole('button')[0]).toHaveFocus();

    fireEvent.click(button());

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('is open from the start when the state says so', () => {
    show(stateWith(true));

    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(button()).toHaveAttribute('aria-controls');
  });

  it('lists the views, but not Same window, Attach media… or Existing window…', () => {
    show(stateWith(true));

    const names = screen.getAllByRole('button').map((one) => one.textContent);

    expect(names).toStrictEqual(expect.arrayContaining(['Home', 'Composer', 'Hashtag…', 'DM…']));
    expect(names).not.toContain('Same window');
    expect(names).not.toContain('Attach media…');
    expect(names).not.toContain('Existing window…');
  });

  it('runs /float <view> for a row and closes the menu', () => {
    const run = show(stateWith(true));

    fireEvent.click(row('Home'));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/float home', prefill: false });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('asks in the dialog for a row that asks, runs the answered line and closes', () => {
    const run = show(stateWith(true));

    fireEvent.click(row('Hashtag…'));
    fireEvent.mouseDown(screen.getByRole('dialog'));

    expect(screen.getByRole('toolbar')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '#rust' } });
    fireEvent.click(row('OK'));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/float tag rust', prefill: false });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('closes on Esc inside it and hands focus back to the button', () => {
    show(stateWith(true));

    fireEvent.keyDown(row('Home'), { key: 'Escape' });

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it('stays open for other keys, and for Esc pressed outside it or in its dialog', () => {
    show(stateWith(true));

    fireEvent.keyDown(row('Home'), { key: 'ArrowDown' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(row('Hashtag…'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('closes on a mousedown outside it, not on one inside it', () => {
    show(stateWith(true));

    fireEvent.mouseDown(row('Home'));
    fireEvent.mouseDown(button());

    expect(screen.getByRole('toolbar')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('closes on a mousedown that has no element for a target', () => {
    show(stateWith(true));

    fireEvent.mouseDown(document);

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
});
