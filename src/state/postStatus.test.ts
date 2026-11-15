/**
 * Tests for the shared posting helper: with a session behind the window the
 * draft becomes one create on that account's instance — the reader's default
 * audience filling an unset one, an idempotency key on the request — and the
 * status the server answers with lands in that same window's scrollback as
 * newer; a refused create returns what the reader is shown and moves no buffer;
 * a window with nobody signed in to post as says to log in and asks the network
 * for nothing at all.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import { postStatus } from './postStatus';
import { type AppAction, appReducer } from './reducer';
import { bufferFor } from './selectors';
import type { PostContext } from './windowKind';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { Visibility } from '../api/schemas/status';
import { TEST_DATE, status } from '../test/fixtures';
import { server } from '../test/server';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const CREATE = `${ORIGIN}/api/v1/statuses`;

/** The status the instance answers a create with. */
const CREATED = status('42', { content: '<p>Close the world. Open the nExt.</p>' });

/** The one account these posts go out as, and the window that shows them. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(HOME);

/** The state of a session signed in as {@link ACCOUNT} with its home window open. */
function signedIn(defaultVisibility?: Visibility): AppState {
  const accounts = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  const opened = coreReducer(accounts, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  return defaultVisibility === undefined
    ? opened
    : coreReducer(opened, { type: 'settings', settings: { defaultVisibility } });
}

/** A post context over {@link state} and the dispatch it records asks for. */
function contextFor(state: AppState): {
  readonly context: PostContext;
  readonly dispatch: Mock<PostContext['dispatch']>;
} {
  const dispatch = vi.fn<PostContext['dispatch']>();
  return {
    context: { state, dispatch, now: () => new Date(TEST_DATE) },
    dispatch,
  };
}

/** The one reducer ask {@link dispatch} recorded, failing when it recorded none. */
function onlyAsk(dispatch: Mock<PostContext['dispatch']>): AppAction {
  const [call] = dispatch.mock.calls;
  if (call === undefined) {
    throw new Error('postStatus asked the reducer for nothing');
  }
  return call[0];
}

/** The body the create must carry, or the test fails inside the handler. */
function serveCreate(body: Record<string, unknown>): void {
  server.use(
    http.post(CREATE, async ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer never-logged');
      expect(request.headers.get('Idempotency-Key')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
      );

      const sent: unknown = await request.json();

      expect(sent).toStrictEqual(body);

      return HttpResponse.json(CREATED);
    }),
  );
}

describe(postStatus, () => {
  it('creates the post and adds the answer to the window as newer', async () => {
    serveCreate({ status: 'hello lain', visibility: 'public' });
    const { context, dispatch } = contextFor(signedIn());

    await expect(
      postStatus(context, {
        accountKey: ACCOUNT.key,
        windowId: WINDOW,
        draft: { text: 'hello lain' },
      }),
    ).resolves.toBeNull();

    expect(dispatch).toHaveBeenCalledWith({
      statuses: [CREATED],
      type: 'statuses',
      where: 'newer',
      windowId: WINDOW,
    });

    const posted = appReducer(context.state, onlyAsk(dispatch));
    const postLines = bufferFor(posted, WINDOW).lines.filter((line) => line.kind === 'post');

    expect(postLines.map((line) => line.status)).toStrictEqual([CREATED]);
  });

  it('aims an unset audience at the reader’s own default', async () => {
    serveCreate({ status: 'private word', visibility: 'private' });
    const { context, dispatch } = contextFor(signedIn('private'));

    const message = await postStatus(context, {
      accountKey: ACCOUNT.key,
      windowId: WINDOW,
      draft: { text: 'private word' },
    });

    expect(message).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('sends the audience, spoiler and reply target the draft names', async () => {
    serveCreate({
      in_reply_to_id: '7',
      visibility: 'unlisted',
      spoiler_text: 'nExt',
      status: 'replying',
    });
    const { context } = contextFor(signedIn('private'));

    const message = await postStatus(context, {
      accountKey: ACCOUNT.key,
      windowId: WINDOW,
      draft: { text: 'replying', spoilerText: 'nExt', visibility: 'unlisted', inReplyToId: '7' },
    });

    expect(message).toBeNull();
  });

  it('reports a refused create and moves no scrollback', async () => {
    server.use(
      http.post(CREATE, () => {
        return HttpResponse.json(
          { error: "Validation failed: Text can't be blank" },
          { status: 422 },
        );
      }),
    );
    const { context, dispatch } = contextFor(signedIn());

    const message = await postStatus(context, {
      accountKey: ACCOUNT.key,
      windowId: WINDOW,
      draft: { text: '' },
    });

    expect(message).toBe("HTTP 422: Validation failed: Text can't be blank");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('says to log in when no account is signed in', async () => {
    const { context, dispatch } = contextFor(initialAppState());

    const message = await postStatus(context, {
      accountKey: null,
      windowId: WINDOW,
      draft: { text: 'hello' },
    });

    expect(message).toBe('Not logged in. Type /connect');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('says to log in when the window has no account any more', async () => {
    const { context, dispatch } = contextFor(signedIn());

    const message = await postStatus(context, {
      accountKey: accountKey(ORIGIN, 'other'),
      windowId: WINDOW,
      draft: { text: 'hello' },
    });

    expect(message).toBe('Not logged in. Type /connect');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
