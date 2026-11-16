/**
 * Tests for Tab completion in the running shell (WFE-124): `/he` + Tab writes
 * `/help `, the handle of an account a buffer showed completes from `@al`,
 * Tab cycles through the candidates and Shift+Tab steps back, any other key
 * ends the completion, a word nothing can complete leaves Tab to the browser,
 * navigation mode leaves the chord alone, and `:la` completes to the emoji
 * once the account's instance has answered. Startup is mocked; it has its
 * own tests.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { type AppState, initialAppState } from '../state/appState';
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
};

/** The home window the tests open; its kind draws the scrollback and fetches. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** Alice: an account the buffer shows, so her handle can be completed to. */
const ALICE = status('seed-alice', {
  account: {
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
  },
  tags: [{ name: 'LAN', url: 'https://m.example/tags/LAN' }],
});

/** A session signed in, with one home window already showing alice. */
const SEED: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
  { type: 'statuses', windowId: windowId(HOME), statuses: [ALICE], where: 'newer' },
];

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
function line(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Shows {@link text} on the command line, as typing it would. */
function type(text: string): void {
  fireEvent.change(line(), { target: { value: text } });
}

/** Presses Tab — with Shift when told to; true when the browser kept the key. */
function tab(shiftKey = false): boolean {
  return fireEvent.keyDown(line(), { key: 'Tab', shiftKey });
}

/** The instance the account stands in for: an empty home and one emoji. */
function serveWired(): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/timelines/home`, () => {
      return HttpResponse.json([]);
    }),
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => {
      return HttpResponse.json([{ shortcode: 'lain', url: `${ORIGIN}/e/lain.png` }]);
    }),
  );
}

describe(Root, () => {
  beforeEach(serveWired);

  it('completes /he to /help and takes the Tab', () => {
    renderRoot(SEED);

    type('/he');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('/help ');
  });

  it('cycles the candidates forward with Tab', () => {
    renderRoot(SEED);

    type('/wi');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('/wi ');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('/win ');
  });

  it('steps back with Shift+Tab, wrapping at both ends', () => {
    renderRoot(SEED);

    type('/wi');

    tab();

    tab();

    expect(line()).toHaveValue('/win ');

    tab(true);

    expect(line()).toHaveValue('/wi ');

    expect(tab(true)).toBe(false);
    expect(line()).toHaveValue('/window ');
  });

  it('completes a handle an account in a buffer showed', () => {
    renderRoot(SEED);

    type('@al');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('@alice@m.example ');
  });

  it('completes a hashtag a status carried', () => {
    renderRoot(SEED);

    type('#lan');

    expect(tab()).toBe(false);
    expect(line()).toHaveValue('#LAN ');
  });

  it('ends the completion when any other key is pressed', () => {
    renderRoot(SEED);

    type('@al');

    tab();

    expect(line()).toHaveValue('@alice@m.example ');

    fireEvent.keyDown(line(), { key: 'z' });

    expect(tab()).toBe(true);
    expect(line()).toHaveValue('@alice@m.example ');
  });

  it('leaves Tab to the browser when the word has nothing to complete', () => {
    renderRoot(SEED);

    type('hello');

    expect(tab()).toBe(true);
    expect(line()).toHaveValue('hello');
  });

  it('leaves Tab alone in navigation mode', () => {
    renderRoot(SEED);

    fireEvent.keyDown(window, { key: 'Escape' });

    type('/he');

    expect(tab()).toBe(true);
    expect(line()).toHaveValue('/he');
  });

  it('completes a custom emoji once the instance has answered', async () => {
    renderRoot(SEED);

    await waitFor(() => {
      type(':la');

      tab();

      expect(line()).toHaveValue(':lain: ');
    });
  });
});
