/**
 * Tests for the timeline loader over the shared MSW server: the idle buffer's
 * first page fills the scrollback newest-last and flips the load, a failed
 * page prints its description and fails the load, an older request fetches
 * the cursor page and exhausts the window when no next link comes, a window
 * with no session prints its error once and asks nothing of the endpoint,
 * and unmounting aborts the page in flight, reporting nothing but idle.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { BufferView } from './BufferView';
import { TIMELINE_PAGE_SIZE, type FetchPage, useTimeline } from './useTimeline';
import type { StoredAccount } from '../accounts/accountStore';
import { homeTimeline } from '../api/endpoints/timelines';
import { ok } from '../lib/result';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { status } from '../test/fixtures';
import { server } from '../test/server';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const HOME = `${ORIGIN}/api/v1/timelines/home`;

/** What a {@link FetchPage} under test resolves to. */
type PageResult = Awaited<ReturnType<FetchPage>>;

/** The outcome a cancelled request answers with; the hook must swallow it. */
const ABORTED = { ok: false, error: { kind: 'aborted' } } as const satisfies PageResult;

const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#acct-1`,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(REF);

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
function TimelineLoader(props: { readonly fetchPage: FetchPage }) {
  useTimeline(WINDOW, props.fetchPage);
  return <BufferView label="home timeline" windowId={WINDOW} />;
}

/** Loader, probe and older-button on top of {@link state}. */
function hosted(fetchPage: FetchPage, state: AppState) {
  return (
    <AppStateProvider initial={state}>
      <TimelineLoader fetchPage={fetchPage} />
      <Probe />
      <OlderButton />
    </AppStateProvider>
  );
}

/** The home window open, signed in unless {@link withAccount} says otherwise. */
function opened(withAccount = true): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: withAccount ? [ACCOUNT] : [],
    activeKey: withAccount ? ACCOUNT.key : null,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
}

/** The window's posts, newest first as the API sends them. */
const FIRST = status('1', { content: '<p>first</p>' });
const SECOND = status('2', { content: '<p>second</p>' });
const OLD = status('0', { content: '<p>oldest</p>' });

/** Serve the home timeline: page 1 links to max_id=1, page 2 links nowhere. */
function serveHome(): void {
  server.use(
    http.get(HOME, ({ request }) => {
      const url = new URL(request.url);

      expect(url.searchParams.get('limit')).toBe(String(TIMELINE_PAGE_SIZE));

      if (url.searchParams.get('max_id') === null) {
        return HttpResponse.json([SECOND, FIRST], {
          headers: { Link: `<${HOME}?max_id=1&limit=40>; rel="next"` },
        });
      }
      return HttpResponse.json([OLD]);
    }),
  );
}

describe(useTimeline, () => {
  it('fills an idle buffer with the first page', async () => {
    serveHome();
    render(hosted(homeTimeline, opened()));

    await screen.findByText('loaded');

    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('lines 2');
    expect(screen.getByRole('log', { name: 'home timeline' })).toBeInTheDocument();
  });

  it('prints a failed page and marks the buffer in error', async () => {
    server.use(
      http.get(HOME, () => {
        return HttpResponse.json({ error: 'gone fishing' }, { status: 502 });
      }),
    );
    render(hosted(homeTimeline, opened()));

    await screen.findByText('HTTP 502: gone fishing');

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.queryByText('first')).toBeNull();
  });

  it('loads the asked-for older page and exhausts without a next link', async () => {
    serveHome();
    render(hosted(homeTimeline, opened()));
    await screen.findByText('loaded');

    fireEvent.click(screen.getByRole('button', { name: 'load older' }));

    await screen.findByText('oldest');

    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('exhausted true');
    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('lines 3');
    expect(screen.getAllByRole('article')[0]?.textContent).toContain('oldest');
  });

  it('prints one error for a window with no session, and asks the endpoint nothing', async () => {
    let asked = 0;
    const counting: FetchPage = async () => {
      asked += 1;
      await Promise.resolve();
      return ok({ items: [], links: { next: null, prev: null } });
    };
    render(hosted(counting, opened(false)));

    await screen.findByText('No account for this window');

    expect(screen.getAllByText('No account for this window')).toHaveLength(1);

    expect(asked).toBe(0);
    expect(screen.getByText('idle')).toBeInTheDocument();
  });

  it('ignores an aborted answer from a window that is still mounted', async () => {
    const aborted: FetchPage = async () => {
      await Promise.resolve();
      return ABORTED;
    };
    render(hosted(aborted, opened()));

    await screen.findByText('loading');

    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('lines 0');
    expect(screen.queryByText('Request cancelled')).toBeNull();
  });

  it('aborts the in-flight page on unmount and reports nothing but idle', async () => {
    const signals: AbortSignal[] = [];
    const pending: Promise<PageResult>[] = [];
    const hanging: FetchPage = async (_session, _page, signal) => {
      signals.push(signal);
      const page = new Promise<PageResult>((resolve) => {
        signal.addEventListener('abort', () => {
          resolve(ABORTED);
        });
      });
      pending.push(page);
      return page;
    };
    const state = opened();
    const view = render(hosted(hanging, state));
    await screen.findByText('loading');

    view.rerender(
      <AppStateProvider initial={state}>
        <Probe />
        <OlderButton />
      </AppStateProvider>,
    );
    await act(async () => {
      await Promise.all(pending);
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('lines 0');
    expect(screen.getByText('idle')).toBeInTheDocument();
    expect(screen.queryByText('Request cancelled')).toBeNull();
  });
});
