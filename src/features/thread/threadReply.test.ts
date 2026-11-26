/**
 * Tests for the thread reply rule (WFE-286): the defaults an empty box starts
 * from are the answered post's audience and warning, the reader's default
 * audience where the post leaves it open, and nothing while the target is not
 * on show; a reply names the people the answer must mention, keeps the
 * answered post's audience, and what the reader set on the draft wins; a
 * window with no target refuses.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { postReply, replyDefaults } from './threadReply';
import type { Status } from '../../api/schemas/status';
import type { AppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import type { PostContext } from '../../state/windowKind';
import { TEST_DATE, status } from '../../test/fixtures';
import { server } from '../../test/server';
import { ORIGIN, THREAD_ACCOUNT, THREAD_WINDOW, threadState } from '../../test/threadWindow';
import { activeWindow } from '../../windows/model';
import type { WindowState } from '../../windows/model';

const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** A private post by nine, behind a warning, naming alice. */
const PRIVATE = status('5', {
  account: {
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
  },
  visibility: 'private',
  spoiler_text: 'gone',
  mentions: [{ id: 'a', username: 'alice', acct: 'alice@wired.example', url: 'https://x/a' }],
});
const PUBLIC = status('5');

/** The thread window over a state that shows {@link posts}. */
function showing(posts: readonly Status[]): AppState {
  return appReducer(threadState(), {
    type: 'statuses',
    windowId: THREAD_WINDOW,
    statuses: posts,
    where: 'newer',
  });
}

/** A post context over {@link state}, and what it dispatched. */
function contextOf(state: AppState): {
  readonly context: PostContext;
  readonly dispatch: ReturnType<typeof vi.fn<PostContext['dispatch']>>;
} {
  const dispatch = vi.fn<PostContext['dispatch']>();
  return { context: { state, dispatch, now: () => new Date(TEST_DATE) }, dispatch };
}

/** A window of the thread kind that targets nothing. */
function targetless(): WindowState {
  return {
    id: 'thread-untargeted',
    ref: { kind: 'thread', accountKey: THREAD_ACCOUNT.key, target: null },
    title: 'thread/-',
    unread: 0,
    highlight: false,
    display: {},
  };
}

/** Serve one create, recording the body it was sent. */
function recordCreate(bodies: unknown[]): void {
  server.use(
    http.post(CREATE_URL, async ({ request }) => {
      bodies.push(await request.json());

      return HttpResponse.json(status('42'));
    }),
  );
}

describe(replyDefaults, () => {
  it('starts from the audience and the warning of a private post', () => {
    const state = showing([PRIVATE]);

    expect(replyDefaults(state, activeWindow(state.windows))).toStrictEqual({
      text: '',
      spoiler: 'gone',
      visibility: 'private',
    });
  });

  it('starts from the reader’s default audience for a public post', () => {
    const state = showing([PUBLIC]);

    expect(replyDefaults(state, activeWindow(state.windows))).toStrictEqual({
      text: '',
      spoiler: '',
      visibility: state.settings.defaultVisibility,
    });
  });

  it('has nothing while the target is not on show', () => {
    const state = showing([]);

    expect(replyDefaults(state, activeWindow(state.windows))).toBeNull();
  });

  it('has nothing for a window that targets no post', () => {
    expect(replyDefaults(showing([PUBLIC]), targetless())).toBeNull();
  });
});

describe(postReply, () => {
  it('answers the target mentioning its people, keeping its audience and warning', async () => {
    const bodies: unknown[] = [];
    recordCreate(bodies);
    const state = showing([PRIVATE]);
    const { context, dispatch } = contextOf(state);

    await expect(
      postReply({ text: 'hello' }, activeWindow(state.windows), context),
    ).resolves.toBeNull();

    expect(bodies).toStrictEqual([
      {
        status: '@nine@pleroma.example @alice@wired.example hello',
        spoiler_text: 'gone',
        visibility: 'private',
        in_reply_to_id: '5',
      },
    ]);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'statuses' }));
  });

  it('lets the fields the reader set win over the reply defaults', async () => {
    const bodies: unknown[] = [];
    recordCreate(bodies);
    const state = showing([PRIVATE]);
    const { context } = contextOf(state);

    await postReply(
      { text: 'hello', spoilerText: 'mine', visibility: 'unlisted' },
      activeWindow(state.windows),
      context,
    );

    expect(bodies).toStrictEqual([
      {
        status: '@nine@pleroma.example @alice@wired.example hello',
        spoiler_text: 'mine',
        visibility: 'unlisted',
        in_reply_to_id: '5',
      },
    ]);
  });

  it('refuses when the window has nothing to reply to', async () => {
    const { context, dispatch } = contextOf(showing([PUBLIC]));

    await expect(postReply({ text: 'hello' }, targetless(), context)).resolves.toBe(
      'Nothing to reply to in this window',
    );

    expect(dispatch).not.toHaveBeenCalled();
  });
});
