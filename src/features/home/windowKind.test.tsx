/**
 * Tests for the home window kind: the definition it self-registers and the topic
 * line it shows, that its component pages the home timeline into its own
 * scrollback, and that posting through the kind creates the status as the
 * window's own account and lands it in that same window — or says to log in when
 * the window has no account to post as.
 */
import { render, screen, within } from '@testing-library/react';
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
const HOME_URL = `${ORIGIN}/api/v1/timelines/home`;
const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** The session's one account, and the home window it owns. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(HOME);

/** The post the home timeline answers with, and the one a create returns. */
const EARLIER = status('7', { content: '<p>present day</p>' });
const CREATED = status('42', { content: '<p>hello lain</p>' });

/** A signed-in session with its home window open, or an unsigned one without an account. */
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
    action: { type: 'open', ref: signed ? HOME : { ...HOME, accountKey: null }, title: 'home' },
  });
}

/** The home window of {@link state}, the one the kind is asked about. */
function homeWindow(state: AppState): WindowState {
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

/** What posting in the home kind does, failing when the kind cannot post at all. */
async function post(draft: Draft, win: WindowState, context: PostContext): Promise<string | null> {
  const onPost = windowKind.onPost;
  if (onPost === undefined) {
    throw new Error('the home window kind takes no posts');
  }
  return await onPost(draft, win, context);
}

/** Show the kind's component over the state {@link state}. */
function renderHome(state: AppState): void {
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={state}>
      <Component windowId={WINDOW} />
    </AppStateProvider>,
  );
}

describe('the home window kind', () => {
  it('is the definition for the home kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('home');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
  });

  it('topics its window as the home timeline', () => {
    const state = opened();

    expect(windowKind.topic(homeWindow(state), state)).toBe('home timeline');
  });

  it('fills a log region named home with the timeline’s first page', async () => {
    server.use(
      http.get(HOME_URL, () => {
        return HttpResponse.json([EARLIER]);
      }),
    );

    renderHome(opened());

    const log = await screen.findByRole('log', { name: 'home' });

    const line = await within(log).findByText('present day');

    expect(line).toBeInTheDocument();
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

    await expect(post({ text: 'hello lain' }, homeWindow(state), context)).resolves.toBeNull();

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

    await expect(post({ text: 'hello' }, homeWindow(state), context)).resolves.toBe(
      'Not logged in. Type /connect',
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});
