/**
 * Refusal and placement tests for /reply: the refusals come before any
 * posting, so no handler is registered for them and any network call would
 * fail the test — no named or selected post and
 * nobody signed in refuse through the resolver. An instance that says no
 * answers with its error and nothing is printed or dispatched. And the
 * answer lands where it belongs: into the active thread or dm window's
 * scrollback like the home window's, while the status window — no
 * conversation — only prints.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './reply';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { TEST_DATE, status } from '../../test/fixtures';
import { server } from '../../test/server';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window shows the posts. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

/** Window 1: no conversation, so nothing to add an answer to. */
const STATUS_WINDOW: WindowRef = { kind: 'status', accountKey: null, target: null };

/** Nine: the author the tests answer, on somebody else's instance. */
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

/** The mention wire object alice arrives as. */
const ALICE = {
  id: 'al',
  username: 'alice',
  acct: 'alice@wired.example',
  url: 'https://wired.example/@alice',
};

/** Nine's public post mentioning alice: the line the command labels `a0`. */
const POST = status('7', { account: NINE_WIRE, mentions: [ALICE] });

/**
 * Lain's signed-in state whose active window is {@link ref}, showing
 * {@link posts}; the caller selects a post when it sends {@link selectedId}.
 */
function feedState(
  ref: WindowRef,
  posts: readonly Status[],
  selectedId: string | null = null,
): CommandContext {
  const context = fakeCommandContext();
  const withAccount = appReducer(context.state, {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(withAccount, {
    type: 'windows',
    action: { type: 'open', ref, title: ref.kind },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: windowId(ref),
    statuses: posts,
    where: 'newer',
  });
  const state =
    selectedId === null
      ? filled
      : appReducer(filled, {
          type: 'select',
          windowId: windowId(ref),
          key: `post:${selectedId}`,
        });
  return { ...context, state, windows: state.windows };
}

describe('/reply refusals', () => {
  it('refuses through the resolver when no post is named or selected', async () => {
    const context = feedState(HOME, [POST]);

    await expect(command.run('hello there', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
    await expect(command.run('a9 hello', context)).resolves.toStrictEqual({
      ok: false,
      message: 'No post a9 here',
    });
  });

  it('refuses to send with nobody signed in', async () => {
    const context = fakeCommandContext();

    await expect(command.run('a0 hi', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });
  });

  it('reports what the instance says about a failed answer', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json({ error: 'Cannot reply to yourself' }, { status: 422 });
      }),
    );
    const context = feedState(HOME, [POST]);

    const outcome = await command.run('a0 hi', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: Cannot reply to yourself' });
    expect(context.print).not.toHaveBeenCalled();
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('adds the answer to the active thread and dm windows too', async () => {
    const refs: readonly WindowRef[] = [
      { kind: 'thread', accountKey: LAIN.key, target: '7' },
      { kind: 'dm', accountKey: LAIN.key, target: 'nine@pleroma.example' },
    ];
    for (const ref of refs) {
      const created = status('reply');
      server.use(
        http.post(`${ORIGIN}/api/v1/statuses`, () => {
          return HttpResponse.json(created);
        }),
      );
      const context = feedState(ref, [POST]);

      await expect(command.run('a0 hi', context)).resolves.toStrictEqual({ ok: true });

      expect(context.dispatch).toHaveBeenCalledWith({
        type: 'statuses',
        windowId: windowId(ref),
        statuses: [created],
        where: 'newer',
      });
    }
  });

  it('prints without touching the scrollback in the status window', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json(status('reply'));
      }),
    );
    const context = feedState(STATUS_WINDOW, [POST]);

    await expect(command.run('a0 hi', context)).resolves.toStrictEqual({ ok: true });

    expect(context.print).toHaveBeenCalledWith('↳ replied to [a0]');
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
