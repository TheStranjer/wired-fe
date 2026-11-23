/**
 * Tests for the page loader's recovery from an expired token, over the shared
 * MSW server: a home window whose first page is refused with 401 trades its
 * refresh token once and renders the page the retry brings, with the new
 * tokens stored; an account that cannot refresh gets the original error in the
 * window and the one expiry line in the status window.
 */
import { render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { BufferView } from './BufferView';
import { useTimeline } from './useTimeline';
import { homeTimeline } from '../api/endpoints/timelines';
import { coreReducer, initialAppState, type AppState } from '../state/appState';
import { RefresherProvider } from '../state/RefreshContext';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { server } from '../test/server';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const HOME_URL = `${ORIGIN}/api/v1/timelines/home`;
const TOKEN_URL = `${ORIGIN}/oauth/token`;
const EXPIRED_LINE = 'Session expired for @lain@wired.example. Type /connect to log in again.';

/** The home window of the one account, and the statuses its page holds. */
const REF: WindowRef = { kind: 'home', accountKey: `${ORIGIN}#1`, target: null };
const WINDOW = windowId(REF);
const FIRST = status('1', { content: '<p>after the refresh</p>' });

/** Serve the home timeline: only the bearer {@link good} gets the page. */
function serveHome(good: string): void {
  server.use(
    http.get(HOME_URL, ({ request }) =>
      request.headers.get('Authorization') === `Bearer ${good}`
        ? HttpResponse.json([FIRST])
        : HttpResponse.json({ error: 'The access token is invalid' }, { status: 401 }),
    ),
  );
}

/** The window's own and the status window's lines as text. */
function Lines() {
  const state = useAppState();
  const texts = [WINDOW, STATUS_WINDOW_ID].flatMap((id) =>
    bufferFor(state, id).lines.flatMap((line) => (line.kind === 'system' ? [line.text] : [])),
  );
  return (
    <ul aria-label="system lines">
      {texts.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}

/** The hook under test drawing the window, signed in as lain with {@link refreshToken}. */
function hosted(refreshToken: string | null) {
  const { accounts } = fakeCommandContext().stores;
  const account = accounts.add({
    origin: ORIGIN,
    accountId: '1',
    handle: 'lain@wired.example',
    token: 'old',
    refreshToken,
    expiresAt: null,
  });
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [account],
    activeKey: account.key,
  });
  const state: AppState = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  const refresher = {
    accounts,
    getApp: async () =>
      await Promise.resolve({ ok: true, value: { client_id: 'c', client_secret: 's' } } as const),
    now: () => 0,
  };
  function Loader() {
    useTimeline(WINDOW, homeTimeline);
    return <BufferView label="home timeline" windowId={WINDOW} />;
  }
  return {
    accounts,
    ui: (
      <AppStateProvider initial={state}>
        <RefresherProvider refresher={refresher}>
          <Loader />
          <Lines />
        </RefresherProvider>
      </AppStateProvider>
    ),
  };
}

describe('usePagedBuffer token recovery', () => {
  it('renders the first page that a 401 refused until the token was refreshed', async () => {
    serveHome('new');
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({ access_token: 'new', refresh_token: 'refresh-2' }),
      ),
    );
    const { ui, accounts } = hosted('refresh-1');

    render(ui);

    await screen.findByText('after the refresh');

    expect(accounts.get(REF.accountKey ?? '')).toMatchObject({
      token: 'new',
      refreshToken: 'refresh-2',
    });
  });

  it('shows the 401 and reports the expiry once when there is no refresh token', async () => {
    serveHome('new');
    const { ui } = hosted(null);

    render(ui);

    const lines = await screen.findByRole('list', { name: 'system lines' });
    await within(lines).findByText('HTTP 401: The access token is invalid');

    expect(within(lines).getAllByText(EXPIRED_LINE)).toHaveLength(1);
  });
});
