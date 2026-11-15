/**
 * Tests for the local window kind: the definition it self-registers and the
 * topic line it shows, that its component pages this instance's own posts — the
 * public endpoint with `local` on every request — into its own scrollback, and
 * that posting through the kind creates the status as the window's own account
 * and lands it in that same window, or says to log in when the window has no
 * account to post as.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { windowKind } from './windowKind';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import type { Draft } from '../../state/draft';
import { AppStateProvider } from '../../state/StateContext';
import type { PostContext } from '../../state/windowKind';
import { TEST_DATE, status } from '../../test/fixtures';
import { server } from '../../test/server';
import { activeWindow, windowId } from '../../windows/model';
import type { WindowRef, WindowState } from '../../windows/model';

const ORIGIN = 'https://wired.example';
const PUBLIC_URL = `${ORIGIN}/api/v1/timelines/public`;
const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** The session's one account, and the local window it owns. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};
const LOCAL: WindowRef = { kind: 'local', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(LOCAL);

/** The post the local timeline answers with, and the one a create returns. */
const EARLIER = status('7', { content: '<p>present day</p>' });
const CREATED = status('42', { content: '<p>hello lain</p>' });

/** A signed-in session with its local window open, or an unsigned one without an account. */
function opened(signed = true): AppState {
  const accounts = signed
    ? coreReducer(initialAppState(), {
        type: 'accounts',
        accounts: [ACCOUNT],
        activeKey: ACCOUNT.key,
      })
    : initialAppState();
  return coreReducer(accounts, {
    type: 'windows',
    action: {
      type: 'open',
      ref: signed ? LOCAL : { ...LOCAL, accountKey: null },
      title: 'local',
    },
  });
}

/** The local window of {@link state}, the one the kind is asked about. */
function localWindow(state: AppState): WindowState {
  return activeWindow(state.windows);
}

/** A post context over {@link state} and the reducer asks it records. */
function postContext(state: AppState): {
  readonly context: PostContext;
  readonly dispatch: Mock<PostContext['dispatch']>;
} {
  const dispatch = vi.fn<PostContext['dispatch']>();
  return { context: { state, dispatch, now: () => new Date(TEST_DATE) }, dispatch };
}

/** What posting in the local kind does, failing when the kind cannot post at all. */
async function post(draft: Draft, win: WindowState, context: PostContext): Promise<string | null> {
  const onPost = windowKind.onPost;
  if (onPost === undefined) {
    throw new Error('the local window kind takes no posts');
  }
  return await onPost(draft, win, context);
}

/** Show the kind's component over the state {@link state}. */
function renderLocal(state: AppState): void {
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={state}>
      <Component windowId={WINDOW} />
    </AppStateProvider>,
  );
}

/** Serve the public timeline, every request narrowed to this instance's posts. */
function serveLocal(): void {
  server.use(
    http.get(PUBLIC_URL, ({ request }) => {
      const url = new URL(request.url);

      expect(url.searchParams.get('local')).toBe('true');
      expect(url.searchParams.get('limit')).toBe('40');

      return HttpResponse.json([EARLIER]);
    }),
  );
}

describe('the local window kind', () => {
  it('is the definition for the local kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('local');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
  });

  it('topics its window as the local timeline', () => {
    const state = opened();

    expect(windowKind.topic(localWindow(state), state)).toBe('local timeline');
  });

  it('fills a log region named local with the instance’s own posts', async () => {
    serveLocal();

    renderLocal(opened());

    const log = await screen.findByRole('log', { name: 'local' });

    expect(log).toHaveTextContent('present day');
  });

  it('creates the post as its window’s account and adds it to that window', async () => {
    server.use(
      http.post(CREATE_URL, async ({ request }) => {
        const sent: unknown = await request.json();

        expect(sent).toStrictEqual({ status: 'hello lain', visibility: 'public' });

        return HttpResponse.json(CREATED);
      }),
    );
    const state = opened();
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello lain' }, localWindow(state), context)).resolves.toBeNull();

    expect(dispatch).toHaveBeenCalledWith({
      statuses: [CREATED],
      type: 'statuses',
      where: 'newer',
      windowId: WINDOW,
    });
  });

  it('says to log in when its window has no account to post as', async () => {
    const state = opened(false);
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello' }, localWindow(state), context)).resolves.toBe(
      'Not logged in. Type /connect',
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});
