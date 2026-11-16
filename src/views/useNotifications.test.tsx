/**
 * Tests for the notifications loader over the shared MSW server: the idle
 * buffer's first page lands as notification lines newest-last and flips the
 * load — a mention shown as its post, a follow as its client message — and an
 * older request fetches the cursor page and exhausts the window when no next
 * link comes. The shared machinery these tests drive — failed pages, missing
 * accounts, unmount aborts — is exercised whole beside it, in
 * ./useTimeline.test.tsx.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { BufferView } from './BufferView';
import {
  NOTIFICATIONS_PAGE_SIZE,
  type FetchNotificationsPage,
  useNotifications,
} from './useNotifications';
import type { StoredAccount } from '../accounts/accountStore';
import { listNotifications } from '../api/endpoints/notifications';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { notification, status } from '../test/fixtures';
import { server } from '../test/server';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const LIST = `${ORIGIN}/api/v1/notifications`;

const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#acct-1`,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};
const REF: WindowRef = { kind: 'notifications', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(REF);

/** The list endpoint, bound the way src/features/notifications binds it. */
const fetchListPage: FetchNotificationsPage = async (session, page, signal) =>
  await listNotifications(session, page === undefined ? {} : { page }, signal);

/** The window's load and paging as text, so the test can read the buffer. */
function Probe() {
  const buffer = bufferFor(useAppState(), WINDOW);
  return (
    <section aria-label="buffer">
      load <span>{buffer.load}</span> exhausted <span>{String(buffer.exhausted)}</span> lines{' '}
      <span>{String(buffer.lines.length)}</span>
    </section>
  );
}

/** Ask the reducer for one older page, like the navigation mode's key does. */
function OlderButton() {
  const dispatch = useAppDispatch();
  return (
    <button
      onClick={() => {
        dispatch({ type: 'requestOlder', windowId: WINDOW });
      }}
      type="button"
    >
      load older
    </button>
  );
}

/** The hook under test drawing the window's scrollback. */
function NotificationsLoader() {
  useNotifications(WINDOW, fetchListPage);
  return <BufferView label="notifications" windowId={WINDOW} />;
}

/** Loader, probe and older-button on top of {@link state}. */
function hosted(state: AppState) {
  return (
    <AppStateProvider initial={state}>
      <NotificationsLoader />
      <Probe />
      <OlderButton />
    </AppStateProvider>
  );
}

/** The notifications window open, signed in as the one account. */
function opened(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'notifs' },
  });
}

/** The notifications the list answers with, newest first as the API sends them. */
const FOLLOW = notification('9', null);
const MENTION = notification('7', status('5', { content: '<p>hello lain</p>' }));
const EARLIER = notification('1', status('3', { content: '<p>oldest ping</p>' }));

/** Serve the list: page 1 links to max_id=7, page 2 links nowhere. */
function serveList(): void {
  server.use(
    http.get(LIST, ({ request }) => {
      const url = new URL(request.url);

      expect(url.searchParams.get('limit')).toBe(String(NOTIFICATIONS_PAGE_SIZE));

      if (url.searchParams.get('max_id') === null) {
        return HttpResponse.json([FOLLOW, MENTION], {
          headers: { Link: `<${LIST}?max_id=7&limit=40>; rel="next"` },
        });
      }

      expect(url.searchParams.get('max_id')).toBe('7');

      return HttpResponse.json([EARLIER]);
    }),
  );
}

describe(useNotifications, () => {
  it('fills an idle buffer with the first page, as notification lines', async () => {
    serveList();
    render(hosted(opened()));

    await screen.findByText('loaded');

    expect(screen.getByText('hello lain')).toBeInTheDocument();
    expect(screen.getByText(/followed you/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('lines 2');
    expect(screen.getByRole('log', { name: 'notifications' })).toBeInTheDocument();
  });

  it('loads the asked-for older page and exhausts without a next link', async () => {
    serveList();
    render(hosted(opened()));
    await screen.findByText('loaded');

    fireEvent.click(screen.getByRole('button', { name: 'load older' }));

    await screen.findByText('oldest ping');

    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('exhausted true');
    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('lines 3');
    expect(screen.getAllByRole('article')[0]?.textContent).toContain('oldest ping');
  });
});
