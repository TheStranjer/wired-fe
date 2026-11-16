/**
 * Tests for posting through the thread window kind: plain text answers the
 * window's target status — the author and its mentions are prefixed (the
 * window's own account skipped), the answered post's id rides along, and a
 * private post's audience and content warning are kept while a public one
 * takes the reader's default and a warning the composer settled on the draft
 * wins. The created status joins the window's own scrollback. A window that
 * shows no target — none fetched yet, a different post, or a ref with
 * nothing to answer — and a window with no account refuse and ask for
 * nothing; the fetch itself is useThread's own story.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { windowKind } from './windowKind';
import type { Status } from '../../api/schemas/status';
import { type AppState, coreReducer } from '../../state/appState';
import type { Draft } from '../../state/draft';
import { appReducer } from '../../state/reducer';
import type { PostContext } from '../../state/windowKind';
import { TEST_DATE, status } from '../../test/fixtures';
import { server } from '../../test/server';
import {
  ORIGIN,
  THREAD_ACCOUNT,
  THREAD_REF,
  THREAD_WINDOW,
  threadState,
  unsigned,
} from '../../test/threadWindow';
import { activeWindow, windowId } from '../../windows/model';
import type { WindowRef, WindowState } from '../../windows/model';

const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** Nine's twelve fields: the author of the private post the tests answer. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** Post five twice over: nine's private one behind a warning, and lain's. */
const PRIVATE = status('5', {
  account: NINE_WIRE,
  content: '<p>hush</p>',
  visibility: 'private',
  spoiler_text: 'gone',
  mentions: [{ id: 'a', username: 'alice', acct: 'alice@wired.example', url: 'https://x/a' }],
});
const OWNED = status('5', { content: '<p>the fourth wall</p>' });
const OTHER = status('8', { content: '<p>not the target</p>' });
const CREATED = status('42', { content: '<p>reply</p>' });

/** The thread window over {@link state} with {@link posts} in its scrollback. */
function showing(state: AppState, posts: readonly Status[]): AppState {
  return appReducer(state, {
    type: 'statuses',
    windowId: THREAD_WINDOW,
    statuses: posts,
    where: 'newer',
  });
}

/** The same window, but nobody is signed in to answer with. */
function orphaned(): AppState {
  const ref: WindowRef = { ...THREAD_REF, accountKey: null };
  const opened = coreReducer(unsigned(threadState()), {
    type: 'windows',
    action: { type: 'open', ref, title: 'thread/a2' },
  });
  return appReducer(opened, {
    type: 'statuses',
    windowId: windowId(ref),
    statuses: [OWNED],
    where: 'newer',
  });
}

/** A window ref carrying no target at all, for the refusal that needs one. */
function targetless(): WindowState {
  return {
    id: 'thread-untargeted',
    ref: { kind: 'thread', accountKey: THREAD_ACCOUNT.key, target: null },
    title: 'thread/-',
    unread: 0,
    highlight: false,
  };
}

/** The signed-in thread window of {@link state} — the one it opened, active. */
function threadWindow(state: AppState): WindowState {
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

/** What posting in the thread kind does, failing when the kind cannot post. */
async function post(draft: Draft, win: WindowState, context: PostContext): Promise<string | null> {
  const onPost = windowKind.onPost;
  if (onPost === undefined) {
    throw new Error('the thread window kind takes no posts');
  }
  return await onPost(draft, win, context);
}

/** Serve a create that answers the body it was sent, or fail the request. */
function serveCreate(expected: Record<string, unknown>): void {
  server.use(
    http.post(CREATE_URL, async ({ request }) => {
      const sent: unknown = await request.json();

      expect(sent).toStrictEqual(expected);

      return HttpResponse.json(CREATED);
    }),
  );
}

describe('the thread window kind posting', () => {
  it('answers a private target with its audience and warning, mentioning its people', async () => {
    serveCreate({
      status: '@nine@pleroma.example @alice@wired.example hello',
      spoiler_text: 'gone',
      visibility: 'private',
      in_reply_to_id: '5',
    });
    const state = showing(threadState(), [PRIVATE]);
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello' }, threadWindow(state), context)).resolves.toBeNull();

    expect(dispatch).toHaveBeenCalledWith({
      statuses: [CREATED],
      type: 'statuses',
      where: 'newer',
      windowId: THREAD_WINDOW,
    });
  });

  it('keeps the draft’s own warning and a public default, answering by id', async () => {
    serveCreate({
      status: 'hello',
      spoiler_text: 'mine',
      visibility: 'public',
      in_reply_to_id: '5',
    });
    const state = showing(threadState(), [OWNED]);
    const { context } = postContext(state);

    await expect(
      post({ text: 'hello', spoilerText: 'mine' }, threadWindow(state), context),
    ).resolves.toBeNull();
  });

  it('refuses to answer when its window shows a different post', async () => {
    // No handler is registered: any request would fail the test.
    const seeded = appReducer(showing(threadState(), [OTHER]), {
      type: 'print',
      windowId: THREAD_WINDOW,
      date: new Date(TEST_DATE),
      level: 'info',
      text: '*** hi',
    });
    const { context, dispatch } = postContext(seeded);

    await expect(post({ text: 'hello' }, threadWindow(seeded), context)).resolves.toBe(
      'Nothing to reply to in this window',
    );

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('refuses to answer when its window targets no post at all', async () => {
    const state = showing(threadState(), [OWNED]);
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello' }, targetless(), context)).resolves.toBe(
      'Nothing to reply to in this window',
    );

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('says to log in when its window has no account to post as', async () => {
    const state = orphaned();
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello' }, threadWindow(state), context)).resolves.toBe(
      'Not logged in. Type /connect',
    );

    expect(dispatch).not.toHaveBeenCalled();
  });
});
