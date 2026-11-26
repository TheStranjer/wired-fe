/**
 * Tests for the inline view list (WFE-298): a plain row runs `/<command>
 * <view>`, a row that asks opens the pane menus' dialog and runs the answered
 * line, the list is one tab stop, and the arrows, Home, End and a letter move
 * focus between rows. The command is a parameter, so `float` runs `/float`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PaneMenuEntry, ViewCommand } from './paneMenu';
import { ViewList } from './ViewList';
import { initialAppState } from '../state/appState';
import { AppStateProvider } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';

/** A row that runs `text` at once. */
function plain(id: string, label: string, text: string): PaneMenuEntry {
  return { id, label, text, literal: false, pick: null, ask: null };
}

const ENTRIES: readonly PaneMenuEntry[] = [
  plain('home', 'Home', 'home'),
  plain('local', 'Local', 'local'),
  {
    ...plain('whois', 'Profile…', 'whois'),
    ask: { title: 'Open profile', placeholder: '@user@instance', suggest: 'accounts' },
  },
  { ...plain('people', 'People here', '/people'), literal: true },
];

/** Draws the list for `command` and answers the spy its rows run through. */
function show(command: ViewCommand = 'vsplit'): (line: PostActionLine) => void {
  const run = vi.fn<(line: PostActionLine) => void>();
  render(
    <AppStateProvider initial={initialAppState()}>
      <ViewList command={command} entries={ENTRIES} label="Open a view" run={run} />
    </AppStateProvider>,
  );
  return run;
}

/** The row called `name`. */
function row(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe(ViewList, () => {
  it('runs /vsplit with the view of a plain row, without prefilling', () => {
    const run = show();

    fireEvent.click(row('Home'));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/vsplit home', prefill: false });
  });

  it('runs the whole line of a literal row', () => {
    const run = show();

    fireEvent.click(row('People here'));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/people', prefill: false });
  });

  it('runs the command it was given', () => {
    const run = show('float');

    fireEvent.click(row('Local'));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/float local', prefill: false });
  });

  it('asks in a dialog for a row that asks, then runs the answered line', () => {
    const run = show();

    fireEvent.click(row('Profile…'));
    const input = screen.getByRole('combobox', { name: 'Open a view' });
    fireEvent.change(input, { target: { value: 'bob@wired2.test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(run).toHaveBeenCalledExactlyOnceWith({
      line: '/vsplit whois @bob@wired2.test',
      prefill: false,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs nothing when the dialog is cancelled', () => {
    const run = show();

    fireEvent.click(row('Profile…'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it('names the list and puts only one row in the tab order', () => {
    show();

    const list = screen.getByRole('toolbar', { name: 'Open a view' });
    const stops = screen.getAllByRole('button').filter((button) => button.tabIndex === 0);

    expect(list).toBeInTheDocument();
    expect(stops).toStrictEqual([row('Home')]);
  });

  it('moves focus with the arrows, wrapping, and takes the tab stop along', () => {
    show();
    row('Home').focus();

    fireEvent.keyDown(row('Home'), { key: 'ArrowDown' });

    expect(row('Local')).toHaveFocus();
    expect(row('Local')).toHaveAttribute('tabindex', '0');
    expect(row('Home')).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(row('Local'), { key: 'ArrowUp' });
    fireEvent.keyDown(row('Home'), { key: 'ArrowUp' });

    expect(row('People here')).toHaveFocus();
  });

  it('jumps to the ends with End and Home and to a row by its first letter', () => {
    show();
    row('Home').focus();

    fireEvent.keyDown(row('Home'), { key: 'End' });

    expect(row('People here')).toHaveFocus();

    fireEvent.keyDown(row('People here'), { key: 'Home' });

    expect(row('Home')).toHaveFocus();

    fireEvent.keyDown(row('Home'), { key: 'p' });

    expect(row('Profile…')).toHaveFocus();
  });

  it('leaves focus alone for a letter no row starts with and for Enter', () => {
    show();
    row('Home').focus();

    fireEvent.keyDown(row('Home'), { key: 'z' });
    fireEvent.keyDown(row('Home'), { key: 'Enter' });

    expect(row('Home')).toHaveFocus();
  });
});
