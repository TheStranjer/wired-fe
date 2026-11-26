/**
 * Tests for the page loader over a window hidden before its first page
 * landed: unmounting aborts that page and puts the load back to idle, so the
 * window asks for its first page again the next time it is shown, which is
 * what `/home` then `/notifs` in one pane does to a slow home timeline.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FetchPageOf } from './pagedFetch';
import { useTimeline } from './useTimeline';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { ok } from '../lib/result';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
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

/** What a page fetch under test resolves to. */
type PageResult = Awaited<ReturnType<FetchPageOf<Status>>>;

/** The window's load and line count as text. */
function Probe() {
  const buffer = bufferFor(useAppState(), WINDOW);
  return (
    <section aria-label="buffer">
      load <span>{buffer.load}</span> lines <span>{String(buffer.lines.length)}</span>
    </section>
  );
}

/** The hook under test, drawing nothing. */
function Loader(props: { readonly fetchPage: FetchPageOf<Status> }) {
  useTimeline(WINDOW, props.fetchPage);
  return null;
}

/** The home window open and signed in. */
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

/** The probe over {@link state}, with the loader mounted while {@link shown}. */
function hosted(fetchPage: FetchPageOf<Status>, state: AppState, shown: boolean) {
  return (
    <AppStateProvider initial={state}>
      <Probe />
      {shown ? <Loader fetchPage={fetchPage} /> : null}
    </AppStateProvider>
  );
}

describe('usePagedBuffer on a window hidden mid-fetch', () => {
  it('asks for the first page again once the window is shown again', async () => {
    const signals: AbortSignal[] = [];
    const hangsOnce: FetchPageOf<Status> = async (_session, _page, signal) => {
      signals.push(signal);
      if (signals.length > 1) {
        return ok({ items: [status('1')], links: { next: null, prev: null } });
      }
      return await new Promise<PageResult>((resolve) => {
        signal.addEventListener('abort', () => {
          resolve({ ok: false, error: { kind: 'aborted' } });
        });
      });
    };
    const state = opened();
    const view = render(hosted(hangsOnce, state, true));
    await screen.findByText('loading');

    view.rerender(hosted(hangsOnce, state, false));
    await screen.findByText('idle');

    expect(signals[0]?.aborted).toBe(true);

    view.rerender(hosted(hangsOnce, state, true));

    await screen.findByText('loaded');

    expect(signals).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'buffer' })).toHaveTextContent('lines 1');
  });
});
