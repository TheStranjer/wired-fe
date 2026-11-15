/**
 * Tests for the shell wired to real state: the status window with its kind's
 * topic, the account handles in the topic bar and the status line, the
 * status line's clock, mode and window entries, switching a window by
 * clicking its entry, the notice for a window kind no feature implements,
 * and the command line clearing after a submit.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

const ACCOUNT: StoredAccount = {
  key: accountKey('https://wired.example', '1'),
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
};

/** The home window the tests open; it has no kind implemented. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** One action for the window list. */
function win(action: WindowsAction): AppAction {
  return { type: 'windows', action };
}

/** A fresh session moved along by {@link actions}. */
function stateAfter(actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

/** Render Root over a session built from {@link actions}. */
function renderRoot(actions: readonly AppAction[]): void {
  render(
    <AppStateProvider initial={stateAfter(actions)}>
      <Root />
    </AppStateProvider>,
  );
}

/** The topic bar, the shell's banner region. */
function banner(): HTMLElement {
  return screen.getByRole('banner');
}

describe(Root, () => {
  it('shows the status window with its kind topic', () => {
    renderRoot([]);

    expect(within(banner()).getByText('status')).toBeInTheDocument();
    expect(within(banner()).getByText('WIRED — Present day. Present time.')).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'status' })).toBeInTheDocument();
  });

  it('names the window and active accounts by handle', () => {
    renderRoot([
      { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
      win({ type: 'open', ref: HOME, title: 'home' }),
    ]);

    expect(within(banner()).getByText('home')).toBeInTheDocument();
    expect(within(banner()).getByText('@lain@wired.example')).toBeInTheDocument();
    expect(screen.getByText('[@lain@wired.example]')).toBeInTheDocument();
  });

  it('lists the clock, mode and windows with unread in the status line', () => {
    renderRoot([
      { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
      win({ type: 'open', ref: HOME, title: 'home' }),
      win({ type: 'activate', id: STATUS_WINDOW_ID }),
      win({ type: 'markUnread', id: windowId(HOME), count: 3, highlight: true }),
    ]);

    expect(screen.getByText(/\[\d{2}:\d{2}\]/)).toBeInTheDocument();
    expect(screen.getByText('[INS]')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Window 2: home, 3 unread, highlighted' }),
    ).toBeInTheDocument();
    expect(within(banner()).getByText('status')).toBeInTheDocument();
  });

  it('switches windows when a status line entry is clicked', () => {
    renderRoot([
      win({ type: 'open', ref: HOME, title: 'home' }),
      win({ type: 'activate', id: STATUS_WINDOW_ID }),
    ]);

    expect(screen.getByRole('log', { name: 'status' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Window 2: home' }));

    expect(screen.getByRole('log', { name: 'home' })).toBeInTheDocument();
    expect(screen.queryByRole('log', { name: 'status' })).toBeNull();
    expect(within(banner()).getByText('home')).toBeInTheDocument();
  });

  it('shows a notice when the window kind has no view', () => {
    renderRoot([
      win({
        type: 'open',
        ref: { kind: 'hashtag', accountKey: null, target: 'cats' },
        title: '#cats',
      }),
    ]);

    const log = screen.getByRole('log', { name: '#cats' });

    expect(within(log).getByText('No view for this window')).toBeInTheDocument();
  });

  it('clears the command line after a submit', () => {
    renderRoot([]);

    const input = screen.getByRole('textbox', { name: 'Command line' });
    fireEvent.change(input, { target: { value: '/help' } });

    expect(input).toHaveValue('/help');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('');
  });
});
