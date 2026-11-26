/**
 * Tests for the shell wired to real state: pane titles with the kind's topic,
 * the account handles in the header and status line, and the command line
 * handing every line to the dispatcher: /help, unknown commands, refused
 * posts, /clear, and the line clearing itself afterwards. The status line's
 * entries are tested in Root.statusLine.test.
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
  return screen.getByRole('combobox', { name: 'Command line' });
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

/** The global header, the first banner (pane title bars are headers too). */
function banner(): HTMLElement {
  const [header] = screen.getAllByRole('banner');
  return header ?? screen.getByRole('banner');
}

describe(Root, () => {
  beforeEach(() => {
    serveEmptyHomeTimeline();
    serveNoCustomEmojis();
  });

  it('shows the status window with its kind topic', () => {
    renderRoot([]);

    const pane = screen.getByRole('region', { name: 'status' });

    expect(within(pane).getByText(/status — WIRED — Present day\. Present time\./)).toBeVisible();
    expect(screen.getByRole('log', { name: 'status' })).toBeInTheDocument();
  });

  it('draws the active desktop in a main region named after its number', () => {
    renderRoot([]);

    const desktop = screen.getByRole('main', { name: 'Desktop 1' });

    expect(within(desktop).getByRole('region', { name: 'status' })).toBeInTheDocument();
  });

  it('titles the focused pane with its window, account and topic', () => {
    renderRoot([
      { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
      win({ type: 'open', ref: HOME, title: 'home' }),
    ]);

    const pane = screen.getByRole('region', { name: 'home @lain@wired.example' });

    expect(within(pane).getByText(/home @lain@wired\.example — home timeline/)).toBeInTheDocument();
    expect(within(banner()).getByText('@lain@wired.example')).toBeInTheDocument();
    expect(screen.getByText('[@lain@wired.example]')).toBeInTheDocument();
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

    const error = await within(screen.getByRole('log', { name: 'status' })).findByText(
      'Unknown command: /nope. Try /help',
    );

    expect(error).toBeInTheDocument();
  });

  it('refuses plain text typed into the status window when nobody is signed in', async () => {
    renderRoot([]);

    submit('hello there');

    const refusal = await within(screen.getByRole('log', { name: 'status' })).findByText(
      'Not logged in. Type /connect',
    );

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
