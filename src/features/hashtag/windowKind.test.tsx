/**
 * Tests for the hashtag window kind: the definition it self-registers and the
 * topic line it shows for its tag, that its component pages that one tag's
 * timeline — `/api/v1/timelines/tag/<target>` — into its own scrollback named
 * after the tag, and that posting through the kind creates the status as the
 * window's own account with the tag appended when the text does not carry it
 * yet, case-insensitively, and left alone when it does. A window with nothing
 * to target posts unchanged, and a window nobody has open names itself plain.
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
const TAG_URL = `${ORIGIN}/api/v1/timelines/tag/lain`;
const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** The session's one account, and the #lain window it owns. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};
const LAIN: WindowRef = { kind: 'hashtag', accountKey: ACCOUNT.key, target: 'lain' };
const WINDOW = windowId(LAIN);

/** The post the tag timeline answers with, and the one a create returns. */
const EARLIER = status('7', { content: '<p>present day</p>' });
const CREATED = status('42', { content: '<p>hello lain</p>' });

/** A signed-in session with its #lain window open, or an unsigned one without an account. */
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
      ref: signed ? LAIN : { ...LAIN, accountKey: null },
      title: '#lain',
    },
  });
}

/** The hashtag window of {@link state}, the one the kind is asked about. */
function hashtagWindow(state: AppState): WindowState {
  return activeWindow(state.windows);
}

/** A window ref carrying no target at all, for the untargeted paths. */
function targetless(accountKeyOf: string | null): WindowState {
  return {
    id: 'hashtag-untargeted',
    ref: { kind: 'hashtag', accountKey: accountKeyOf, target: null },
    title: '#',
    unread: 0,
    highlight: false,
  };
}

/** A post context over {@link state} and the reducer asks it records. */
function postContext(state: AppState): {
  readonly context: PostContext;
  readonly dispatch: Mock<PostContext['dispatch']>;
} {
  const dispatch = vi.fn<PostContext['dispatch']>();
  return { context: { state, dispatch, now: () => new Date(TEST_DATE) }, dispatch };
}

/** What posting in the hashtag kind does, failing when the kind cannot post at all. */
async function post(draft: Draft, win: WindowState, context: PostContext): Promise<string | null> {
  const onPost = windowKind.onPost;
  if (onPost === undefined) {
    throw new Error('the hashtag window kind takes no posts');
  }
  return await onPost(draft, win, context);
}

/** Show the kind's component for the window with {@link id} over {@link state}. */
function renderHashtag(state: AppState, id: string): void {
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={state}>
      <Component windowId={id} />
    </AppStateProvider>,
  );
}

/** Serve the #lain timeline, its pages requested by that exact path. */
function serveTag(): void {
  server.use(
    http.get(TAG_URL, ({ request }) => {
      const url = new URL(request.url);

      expect(url.pathname).toBe('/api/v1/timelines/tag/lain');
      expect(url.searchParams.get('limit')).toBe('40');

      return HttpResponse.json([EARLIER]);
    }),
  );
}

/** Serve a create that echoes back the status text it was sent. */
function serveCreate(expected: string): void {
  server.use(
    http.post(CREATE_URL, async ({ request }) => {
      const sent: unknown = await request.json();

      expect(sent).toStrictEqual({ status: expected, visibility: 'public' });

      return HttpResponse.json(CREATED);
    }),
  );
}

describe('the hashtag window kind', () => {
  it('is the definition for the hashtag kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('hashtag');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
  });

  it('topics its window after the tag it targets, and plainly without one', () => {
    const state = opened();

    expect(windowKind.topic(hashtagWindow(state), state)).toBe('#lain');
    expect(windowKind.topic(targetless(ACCOUNT.key), state)).toBe('');
  });

  it('fills a log region named #lain with the tag timeline’s first page', async () => {
    serveTag();

    renderHashtag(opened(), WINDOW);

    const log = await screen.findByRole('log', { name: '#lain' });

    expect(log).toHaveTextContent('present day');
  });

  it('names an unopened window’s log region plainly and fetches nothing', () => {
    renderHashtag(opened(), 'hashtag:never:opened');

    expect(screen.getByRole('log', { name: 'hashtag' })).toBeEmptyDOMElement();
  });

  it('appends the tag to a post that does not carry it yet', async () => {
    serveCreate('close the world #lain');
    const state = opened();
    const { context, dispatch } = postContext(state);

    const draft = { text: 'close the world' };

    await expect(post(draft, hashtagWindow(state), context)).resolves.toBeNull();

    expect(dispatch).toHaveBeenCalledWith({
      statuses: [CREATED],
      type: 'statuses',
      where: 'newer',
      windowId: WINDOW,
    });
  });

  it('posts a text that already carries the tag unchanged, in any case', async () => {
    serveCreate('loving #Lain today');
    const state = opened();
    const { context } = postContext(state);

    const draft = { text: 'loving #Lain today' };

    await expect(post(draft, hashtagWindow(state), context)).resolves.toBeNull();
  });

  it('posts nothing but the text when its window has no tag to add', async () => {
    serveCreate('hello lain');
    const { context } = postContext(opened());

    await expect(
      post({ text: 'hello lain' }, targetless(ACCOUNT.key), context),
    ).resolves.toBeNull();
  });

  it('says to log in when its window has no account to post as', async () => {
    const state = opened(false);
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello' }, hashtagWindow(state), context)).resolves.toBe(
      'Not logged in. Type /connect',
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});
