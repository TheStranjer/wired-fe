/**
 * Tests for the timeline window: it is the loader and the scrollback joined —
 * the first page arrives in the buffer as lines, an API failure prints its
 * description into the window, paging older grows the same scrollback from
 * the top, and a window without its account says so and fetches nothing.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { TimelineWindow } from './TimelineWindow';
import type { FetchPage } from './useTimeline';
import type { StoredAccount } from '../accounts/accountStore';
import { homeTimeline } from '../api/endpoints/timelines';
import { ok } from '../lib/result';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { AppStateProvider, useAppDispatch } from '../state/StateContext';
import { status } from '../test/fixtures';
import { server } from '../test/server';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const HOME = `${ORIGIN}/api/v1/timelines/home`;

const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#acct-1`,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(REF);

const FIRST = status('1', { content: '<p>hello lain</p>' });
const SECOND = status('2', { content: '<p>close the world</p>' });
const THIRD = status('0', { content: '<p>open the next</p>' });

/** The signed-in app state with the home window open. */
function opened(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
}

/** Asks the reducer for one older page of the window's buffer. */
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

/** Serve home page 1 linked to max_id=1, and its older page unlinked. */
function serveTwoPages(): void {
  server.use(
    http.get(HOME, ({ request }) => {
      const url = new URL(request.url);

      if (url.searchParams.get('max_id') === null) {
        return HttpResponse.json([SECOND, FIRST], {
          headers: { Link: `<${HOME}?max_id=1>; rel="next"` },
        });
      }
      return HttpResponse.json([THIRD]);
    }),
  );
}

describe(TimelineWindow, () => {
  it('names its log region by label and fills it with page one', async () => {
    serveTwoPages();
    render(
      <AppStateProvider initial={opened()}>
        <TimelineWindow fetchPage={homeTimeline} label="home timeline" windowId={WINDOW} />
      </AppStateProvider>,
    );

    const log = await screen.findByRole('log', { name: 'home timeline' });

    expect(log).toHaveTextContent('hello lain');
    expect(log).toHaveTextContent('close the world');
  });

  it('prints an API failure as an error line in the window', async () => {
    server.use(
      http.get(HOME, () => {
        return HttpResponse.json({ error: 'nope' }, { status: 403 });
      }),
    );
    render(
      <AppStateProvider initial={opened()}>
        <TimelineWindow fetchPage={homeTimeline} label="home" windowId={WINDOW} />
      </AppStateProvider>,
    );

    const line = await screen.findByText('HTTP 403: nope');

    expect(line).toBeInTheDocument();
  });

  it('grows the scrollback with the older page the window asks for', async () => {
    serveTwoPages();
    render(
      <AppStateProvider initial={opened()}>
        <TimelineWindow fetchPage={homeTimeline} label="home" windowId={WINDOW} />
        <OlderButton />
      </AppStateProvider>,
    );
    const log = await screen.findByRole('log', { name: 'home' });
    await screen.findByText('hello lain');

    fireEvent.click(screen.getByRole('button', { name: 'load older' }));

    const oldest = await screen.findByText('open the next');

    expect(oldest).toBeInTheDocument();

    const texts = [...log.children].map((line) => line.textContent);

    expect(texts[0]).toContain('open the next');
    expect(texts.at(-1)).toContain('close the world');
  });

  it('prints the no-account error and never calls the endpoint', async () => {
    const missing = coreReducer(initialAppState(), {
      type: 'windows',
      action: { type: 'open', ref: REF, title: 'home' },
    });
    let asked = 0;
    const counting: FetchPage = async () => {
      asked += 1;
      await Promise.resolve();
      return ok({ items: [], links: { next: null, prev: null } });
    };
    render(
      <AppStateProvider initial={missing}>
        <TimelineWindow fetchPage={counting} label="home" windowId={WINDOW} />
      </AppStateProvider>,
    );

    const line = await screen.findByText('No account for this window');

    expect(line).toBeInTheDocument();
    expect(asked).toBe(0);
  });
});
