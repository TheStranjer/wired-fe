/**
 * Tests for the side pane in the running shell (WFE-133): the Users region
 * lists the active home window's participants under "recently here", clicking
 * one opens that author's profile window, and the status window keeps the
 * pane empty. Startup is mocked; it has its own tests.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { status, TEST_DATE } from '../test/fixtures';
import { server } from '../test/server';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

/** The home window the tests open; its kind draws the scrollback and fetches. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** Alice: the author the home buffer shows, as the pane and endpoints see her. */
const ALICE = {
  id: '2',
  username: 'alice',
  acct: 'alice@m.example',
  display_name: 'Alice',
  created_at: TEST_DATE,
  note: '',
  url: 'https://m.example/@alice',
  avatar: 'https://m.example/a.png',
  header: 'https://m.example/h.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

const POST = status('p1', { account: ALICE });

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

/** The shell's Users region. */
function pane(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Users' });
}

/** A signed-in home window showing alice's newest post. */
function seedHome(): readonly AppAction[] {
  return [
    { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
    { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
    { type: 'statuses', windowId: windowId(HOME), statuses: [POST], where: 'newer' },
  ];
}

describe('the side pane in the shell', () => {
  beforeEach(() => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/accounts/2`, () => HttpResponse.json(ALICE)),
      http.get(`${ORIGIN}/api/v1/accounts/relationships`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/accounts/2/statuses`, () => HttpResponse.json([])),
    );
  });

  it('lists the active home window participants under "recently here"', () => {
    renderRoot(seedHome());

    expect(within(pane()).getByText('recently here')).toBeInTheDocument();
    expect(within(pane()).getByRole('button', { name: '@alice@m.example' })).toBeInTheDocument();
  });

  it('opens the profile window when a listed nick is clicked', () => {
    renderRoot(seedHome());

    fireEvent.click(within(pane()).getByRole('button', { name: '@alice@m.example' }));

    const [topic] = screen.getAllByRole('banner');

    expect(topic).toHaveTextContent('@alice@m.example');
  });

  it('keeps the pane empty for the status window', () => {
    renderRoot([]);

    expect(pane()).toBeEmptyDOMElement();
  });
});
