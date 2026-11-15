/**
 * Tests for the hotkeys wired into the shell (AGENTS.md "Two hotkey modes"):
 * Escape switches the status line to [NAV] and blurs the command line, `i` or
 * Enter switches back to [INS] and focuses it; in navigation mode the digits
 * `/win` binds switch windows, in insert mode Alt+digit does the same and
 * plain letters still reach the input; and focusing the command line while
 * navigation is shown switches back to insert. Startup is mocked; it has its
 * own tests.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { server } from '../test/server';
import { STATUS_WINDOW_ID } from '../windows/model';
import type { WindowRef } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

const ACCOUNT: StoredAccount = {
  key: accountKey('https://wired.example', '1'),
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
};

/** The second window the digit chords jump to; src/features/home implements its kind. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** The timeline that window fetches once it is shown, which chords are not about. */
const HOME_TIMELINE = 'https://wired.example/api/v1/timelines/home';

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

/** The command line, focused the way insert mode leaves it. */
function commandLine(): HTMLElement {
  const input = screen.getByRole('textbox', { name: 'Command line' });
  act(() => {
    input.focus();
  });
  return input;
}

/** The two sessions the digit chords have something to jump to. */
const TWO_WINDOWS: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  win({ type: 'open', ref: HOME, title: 'home' }),
  win({ type: 'activate', id: STATUS_WINDOW_ID }),
];

/** The empty home timeline a shown home window asks for, so no request goes unhandled. */
function serveEmptyHomeTimeline(): void {
  server.use(
    http.get(HOME_TIMELINE, () => {
      return HttpResponse.json([]);
    }),
  );
}

describe(Root, () => {
  beforeEach(serveEmptyHomeTimeline);

  it('Escape switches the status line to [NAV] and blurs the command line', () => {
    renderRoot([]);
    const input = commandLine();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByText('[NAV]')).toBeInTheDocument();
    expect(screen.queryByText('[INS]')).toBeNull();
    expect(input).not.toHaveFocus();
  });

  it('i switches back to [INS] and focuses the command line', () => {
    renderRoot([]);
    commandLine();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'i' });

    expect(screen.getByText('[INS]')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Command line' })).toHaveFocus();
  });

  it('the digit switches to that window in navigation mode', async () => {
    renderRoot(TWO_WINDOWS);
    commandLine();
    fireEvent.keyDown(window, { key: 'Escape' });

    fireEvent.keyDown(window, { key: '2' });

    const home = await screen.findByRole('log', { name: 'home' });

    expect(home).toBeInTheDocument();
    expect(screen.getByText('[NAV]')).toBeInTheDocument();
  });

  it('Alt+the digit switches to that window in insert mode', async () => {
    renderRoot(TWO_WINDOWS);

    fireEvent.keyDown(window, { key: '2', altKey: true });

    const home = await screen.findByRole('log', { name: 'home' });

    expect(home).toBeInTheDocument();
    expect(screen.getByText('[INS]')).toBeInTheDocument();
  });

  it('plain letters reach the command line in insert mode', () => {
    renderRoot([]);
    const input = commandLine();

    expect(fireEvent.keyDown(input, { key: 'j' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'a' })).toBe(true);

    expect(screen.getByText('[INS]')).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('focusing the command line while navigation is shown switches back to insert', () => {
    renderRoot([]);
    const input = commandLine();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByText('[NAV]')).toBeInTheDocument();

    act(() => {
      input.focus();
    });

    expect(screen.getByText('[INS]')).toBeInTheDocument();
    expect(input).toHaveFocus();
  });
});
