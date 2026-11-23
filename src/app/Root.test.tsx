/**
 * Tests for the shell wired to real state: the status window with its kind's
 * topic, the account handles in the topic bar and the status line, the status
 * line's clock, mode and window entries, switching a window by clicking its
 * entry, and the command line handing every line to the dispatcher — /help
 * printing the command list,
 * an unknown command printing its error, plain text in the status window
 * printing the refusal to post, /clear emptying the buffer, and the line
 * clearing itself once the command is done with.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
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

/** The home window the tests open; src/features/home implements its kind. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** The timeline that window fetches, which these shell tests do not care about. */
const HOME_TIMELINE = 'https://wired.example/api/v1/timelines/home';

/** One action for the window list. */
function win(action: WindowsAction): AppAction {
  return { type: 'windows', action };
}

/** One client message already printed in the active window. */
function printed(text: string): AppAction {
  return { type: 'print', windowId: null, date: new Date(), level: 'info', text };
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

/** The command line, the shell's only textbox. */
function commandLine(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Types {@link text} at the command line and presses Enter. */
function submit(text: string): void {
  const input = commandLine();
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

/** The empty home timeline every home window asks for, so no request goes unhandled. */
function serveEmptyHomeTimeline(): void {
  server.use(
    http.get(HOME_TIMELINE, () => {
      return HttpResponse.json([]);
    }),
  );
}

/** The emoji list the shell fetches for the active account, answered empty. */
function serveNoCustomEmojis(): void {
  server.use(
    http.get('https://wired.example/api/v1/custom_emojis', () => {
      return HttpResponse.json([]);
    }),
  );
}

/** The topic bar, the shell's banner region. */
function banner(): HTMLElement {
  return screen.getByRole('banner');
}

describe(Root, () => {
  beforeEach(() => {
    serveEmptyHomeTimeline();
    serveNoCustomEmojis();
  });

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

  it('prints the command list into the active window when /help runs', async () => {
    renderRoot([]);

    submit('/help');

    const header = await screen.findByText('Commands:');

    expect(header).toBeInTheDocument();
    expect(screen.getByText('/help — List commands, or show help for one')).toBeInTheDocument();
    expect(screen.getByText('/clear — Clear the active window')).toBeInTheDocument();
    expect(screen.getByText('Type /help <command> for details.')).toBeInTheDocument();
  });

  it('prints the unknown-command error', async () => {
    renderRoot([]);

    submit('/nope');

    const error = await screen.findByText('Unknown command: /nope. Try /help');

    expect(error).toBeInTheDocument();
  });

  it('refuses plain text typed into the status window', async () => {
    renderRoot([]);

    submit('hello there');

    const refusal = await screen.findByText("You can't post in this window. Try /home");

    expect(refusal).toBeInTheDocument();
  });

  it('empties the active window when /clear runs', async () => {
    renderRoot([printed('a line to lose')]);

    expect(screen.getByText('a line to lose')).toBeInTheDocument();

    submit('/clear');

    await waitFor(() => {
      expect(screen.queryByText('a line to lose')).toBeNull();
    });
  });

  it('clears the command line once the line it holds is done with', async () => {
    renderRoot([]);
    const input = commandLine();

    submit('/help');

    expect(input).toHaveValue('/help');

    const header = await screen.findByText('Commands:');

    expect(header).toBeInTheDocument();

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });
});
