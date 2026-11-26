/**
 * Tests for the suggestion list on `@handle`, `#tag` and `:emoji:` words
 * (WFE-300) in the running shell: `@al` lists the account a buffer showed
 * with its display name, an account the instance's search finds joins the
 * list below it after a pause and Tab and a click complete to it, `#ze`
 * lists the tags the buffers carried and `:fox` lists the emoji with its
 * image once the instance has served its emoji. Startup is mocked; the
 * instance is served by MSW, and the pause is real time: the fake-timer
 * tests of it are in src/views/useHandleSearch.test.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
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

/** The home window the tests open. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** An account as an instance serves it: the twelve fields every backend sends. */
function wireAccount(username: string, host: string, name: string): Record<string, unknown> {
  return {
    id: `id-${username}`,
    username,
    acct: `${username}@${host}`,
    display_name: name,
    created_at: TEST_DATE,
    note: '',
    url: `https://${host}/@${username}`,
    avatar: `https://${host}/a.png`,
    header: `https://${host}/h.png`,
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
  };
}

/** Alice, whom the home window showed, carrying two tags. */
const ALICE = status('seed-alice', {
  account: wireAccount('alice', 'm.example', 'Alice Liddell'),
  tags: [
    { name: 'zen', url: 'https://m.example/tags/zen' },
    { name: 'zero', url: 'https://m.example/tags/zero' },
  ],
});

/** A session signed in, with one home window already showing alice. */
const SEED: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
  { type: 'statuses', windowId: windowId(HOME), statuses: [ALICE], where: 'newer' },
];

/** The rows the list shows for alice and for the account the search finds. */
const ALICE_ROW = '@alice@m.example — Alice Liddell';
const ALEX_ROW = '@alex@o.example — Alex Mercer :blobcat:';

/** Render Root over the seeded session. */
function renderRoot(): void {
  render(
    <AppStateProvider initial={SEED.reduce(appReducer, initialAppState())}>
      <Root />
    </AppStateProvider>,
  );
}

/** The command line. */
function line(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Command line' });
}

/** Shows {@link text} on the command line, as typing it would. */
function type(text: string): void {
  fireEvent.change(line(), { target: { value: text } });
}

/** The names of the rows on show. */
function rows(): readonly (string | null)[] {
  return screen.queryAllByRole('option').map((option) => option.textContent);
}

describe('the suggestion list for words', () => {
  beforeEach(() => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, ({ request }) => {
        const query = new URL(request.url).searchParams.get('q');
        const accounts =
          query === 'al' ? [wireAccount('alex', 'o.example', 'Alex Mercer :blobcat:')] : [];
        return HttpResponse.json({ accounts });
      }),
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/custom_emojis`, () =>
        HttpResponse.json([{ shortcode: 'fox', url: `${ORIGIN}/e/fox.png` }]),
      ),
    );
  });

  it('lists a handle a buffer showed with its display name', () => {
    renderRoot();

    type('@al');

    expect(rows()).toStrictEqual([ALICE_ROW]);
    expect(line()).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists the accounts the instance finds below it after the pause, and Tab reaches them', async () => {
    renderRoot();

    type('@al');

    expect(rows()).toStrictEqual([ALICE_ROW]);

    await screen.findByRole('option', { name: ALEX_ROW });

    expect(rows()).toStrictEqual([ALICE_ROW, ALEX_ROW]);

    fireEvent.keyDown(line(), { key: 'Tab' });
    fireEvent.keyDown(line(), { key: 'Tab' });

    expect(line()).toHaveValue('@alex@o.example ');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(ALEX_ROW);
  });

  it('completes to a searched account on a click', async () => {
    renderRoot();

    type('hi @al');
    fireEvent.click(await screen.findByRole('option', { name: ALEX_ROW }));

    expect(line()).toHaveValue('hi @alex@o.example ');
    expect(line()).toHaveFocus();
  });

  it('lists the tags the buffers carried', () => {
    renderRoot();

    type('#ze');

    expect(rows()).toStrictEqual(['#zen', '#zero']);
  });

  it('lists an emoji with its image once the instance has served it', async () => {
    renderRoot();

    await waitFor(() => {
      type(':fo');

      expect(screen.getByRole('img', { name: ':fox:' })).toHaveAttribute(
        'src',
        `${ORIGIN}/e/fox.png`,
      );
    });

    expect(rows()).toStrictEqual([':fox:']);
  });
});
