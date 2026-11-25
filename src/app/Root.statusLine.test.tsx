/**
 * Tests for the status line wired to real state: the clock, mode, desktops and
 * hidden windows with unread, and clicking a desktop or window entry.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { server } from '../test/server';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** Startup has its own tests; the shell tests do not boot the session. */
vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

const ACCOUNT: StoredAccount = {
  key: accountKey('https://wired.example', '1'),
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

/** The home window the tests open. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** One action for the window list. */
function win(action: WindowsAction): AppAction {
  return { type: 'windows', action };
}

/** Render Root over a session built from {@link actions}. */
function renderRoot(actions: readonly AppAction[]): void {
  render(
    <AppStateProvider initial={actions.reduce(appReducer, initialAppState())}>
      <Root />
    </AppStateProvider>,
  );
}

describe('status line in Root', () => {
  beforeEach(() => {
    server.use(
      http.get('https://wired.example/api/v1/timelines/home', () => HttpResponse.json([])),
      http.get('https://wired.example/api/v1/custom_emojis', () => HttpResponse.json([])),
    );
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
    expect(screen.getByRole('button', { name: 'Desktop 1, active' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Window 2: home, 3 unread, highlighted' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'status' })).toBeInTheDocument();
  });

  it('switches windows when a hidden window entry is clicked', () => {
    renderRoot([
      win({ type: 'open', ref: HOME, title: 'home' }),
      win({ type: 'activate', id: STATUS_WINDOW_ID }),
      win({ type: 'markUnread', id: windowId(HOME), count: 3, highlight: false }),
    ]);

    expect(screen.getByRole('log', { name: 'status' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Window 2: home, 3 unread' }));

    expect(screen.getByRole('log', { name: 'home' })).toBeInTheDocument();
    expect(screen.queryByRole('log', { name: 'status' })).toBeNull();
    expect(screen.getByRole('region', { name: 'home' })).toBeInTheDocument();
  });

  it('switches desktops when a desktop entry is clicked', () => {
    renderRoot([{ type: 'layout', action: { type: 'goToDesktop', n: 2 } }]);

    expect(screen.getByRole('main', { name: 'Desktop 2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desktop 1' }));

    expect(screen.getByRole('main', { name: 'Desktop 1' })).toBeInTheDocument();
  });

  it('closes the active desktop with its ×, and then shows no × on the last one', () => {
    renderRoot([{ type: 'layout', action: { type: 'goToDesktop', n: 2 } }]);

    fireEvent.click(screen.getByRole('button', { name: 'Close desktop 2' }));

    expect(screen.getByRole('main', { name: 'Desktop 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Close desktop/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desktop 2' })).not.toBeInTheDocument();
  });

  it('closes a desktop that is middle-clicked and stays on the one that was shown', () => {
    renderRoot([{ type: 'layout', action: { type: 'goToDesktop', n: 3 } }]);

    fireEvent(
      screen.getByRole('button', { name: 'Desktop 2' }),
      new MouseEvent('auxclick', { bubbles: true, button: 1 }),
    );

    expect(screen.getByRole('main', { name: 'Desktop 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close desktop 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desktop 3' })).not.toBeInTheDocument();
  });
});
