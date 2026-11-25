/**
 * Tests for the people window in the running shell (WFE-220, replacing the
 * side pane's WFE-133 tests): there is no fixed Users region any more; `/people`
 * opens the focused window's people in a split to its right at ratio 0.8,
 * keeping focus on the watched window, lists its participants under
 * "recently here", and toggles the pane away when typed again; a nick click
 * opens that author's profile window; the pane says "window closed" once the
 * watched window is closed. Startup is mocked; it has its own tests.
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

/** A signed-in home window showing alice's newest post. */
function seedHome(): readonly AppAction[] {
  return [
    { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
    { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
    { type: 'statuses', windowId: windowId(HOME), statuses: [POST], where: 'newer' },
  ];
}

/** The command line, the shell's only textbox. */
function commandLine(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Types {@link text} at the command line, presses Enter and waits for the line to clear. */
async function run(text: string): Promise<void> {
  fireEvent.change(commandLine(), { target: { value: text } });
  fireEvent.keyDown(commandLine(), { key: 'Enter' });
  await waitFor(() => {
    expect(commandLine()).toHaveValue('');
  });
}

/** The pane of the people window of home. */
function peoplePane(): HTMLElement {
  return screen.getByRole('region', { name: /^people:home/u });
}

describe('the people window in the shell', () => {
  beforeEach(() => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/accounts/2`, () => HttpResponse.json(ALICE)),
      http.get(`${ORIGIN}/api/v1/accounts/relationships`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/accounts/2/statuses`, () => HttpResponse.json([])),
    );
  });

  it('has no fixed Users region', () => {
    renderRoot(seedHome());

    expect(screen.queryByRole('complementary', { name: 'Users' })).toBeNull();
  });

  it('opens the focused window people to its right, keeping focus on the window', async () => {
    renderRoot(seedHome());

    await run('/people');

    expect(within(peoplePane()).getByText('recently here')).toBeInTheDocument();
    expect(
      within(peoplePane()).getByRole('button', { name: '@alice@m.example' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /^home/u })).toHaveAttribute('aria-current', 'true');
    expect(peoplePane()).not.toHaveAttribute('aria-current');
  });

  it('gives the watched window 0.8 of the row', async () => {
    renderRoot(seedHome());

    await run('/people');

    expect(screen.getByRole('region', { name: /^home/u }).closest('div')).toHaveStyle({
      flexGrow: '0.8',
    });
  });

  it('closes the people pane when typed again', async () => {
    renderRoot(seedHome());

    await run('/people');
    await run('/people');

    expect(screen.queryByRole('region', { name: /^people:home/u })).toBeNull();
    expect(screen.getByRole('region', { name: /^home/u })).toHaveAttribute('aria-current', 'true');
  });

  it('opens the profile window when a listed nick is clicked', async () => {
    renderRoot(seedHome());

    await run('/people');
    fireEvent.click(within(peoplePane()).getByRole('button', { name: '@alice@m.example' }));

    expect(screen.getByRole('button', { name: 'Window 4: @alice@m.example' })).toBeInTheDocument();
  });

  it('says "window closed" once the watched window is closed', async () => {
    renderRoot(seedHome());

    await run('/people');
    await run('/close');

    expect(within(peoplePane()).getByText('window closed')).toBeInTheDocument();
  });
});
