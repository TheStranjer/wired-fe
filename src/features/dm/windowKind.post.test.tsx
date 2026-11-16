/**
 * Tests for posting through the DM window kind: plain text is prefixed with
 * the mention of the window's target unless it already names them
 * (case-insensitively), it always goes out `direct`, and it answers the
 * newest direct post the window's scrollback shows — skipping anything more
 * recent that was not said privately. What the composer settled on the draft,
 * a warning or media, rides along; a window with no target to mention and no
 * direct post to answer posts plainly, and a window with no account to post
 * as asks for a login and nothing else.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { windowKind } from './windowKind';
import type { AppState } from '../../state/appState';
import type { Draft } from '../../state/draft';
import { appReducer } from '../../state/reducer';
import type { PostContext } from '../../state/windowKind';
import {
  ALICE_REPLY,
  ALICE_THREAD,
  DM_REF,
  DM_WINDOW,
  ORIGIN,
  dmState,
  showing,
} from '../../test/dmWindow';
import { TEST_DATE, status } from '../../test/fixtures';
import { server } from '../../test/server';
import { activeWindow } from '../../windows/model';
import type { WindowState } from '../../windows/model';

const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** A public shout, newer than every direct word the window shows. */
const SHOUT = status('11', { visibility: 'public', content: '<p>open talk</p>' });
const CREATED = status('42', { visibility: 'direct', content: '<p>private answer</p>' });

/** The signed-in DM window over {@link state} — the one it opened, active. */
function dmWindow(state: AppState): WindowState {
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

/** What posting in the dm kind does, failing when the kind cannot post. */
async function post(draft: Draft, win: WindowState, context: PostContext): Promise<string | null> {
  const onPost = windowKind.onPost;
  if (onPost === undefined) {
    throw new Error('the dm window kind takes no posts');
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

describe('the dm window kind posting', () => {
  it('mentions the target, goes direct, and answers the newest direct post', async () => {
    serveCreate({
      status: '@alice@other.example hello',
      visibility: 'direct',
      in_reply_to_id: ALICE_REPLY.id,
    });
    const state = showing(dmState(), [SHOUT, ...ALICE_THREAD.toReversed()]);
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello' }, dmWindow(state), context)).resolves.toBeNull();

    expect(dispatch).toHaveBeenCalledWith({
      statuses: [CREATED],
      type: 'statuses',
      where: 'newer',
      windowId: DM_WINDOW,
    });
  });

  it('does not mention the target twice, whatever case the text has it in', async () => {
    serveCreate({
      status: 'Hi @Alice@Other.Example!',
      visibility: 'direct',
    });
    const state = showing(dmState(), []);
    const { context } = postContext(state);

    await expect(
      post({ text: 'Hi @Alice@Other.Example!' }, dmWindow(state), context),
    ).resolves.toBeNull();
  });

  it('carries the warning and media the composer settled on the draft', async () => {
    serveCreate({
      status: '@alice@other.example hello',
      spoiler_text: 'mine',
      visibility: 'direct',
      media_ids: ['m1'],
    });
    const state = showing(dmState(), []);
    const { context } = postContext(state);

    await expect(
      post({ text: 'hello', spoilerText: 'mine', mediaIds: ['m1'] }, dmWindow(state), context),
    ).resolves.toBeNull();
  });

  it('says the text plainly, still only to them, when the window has no target', async () => {
    serveCreate({ status: 'hello', visibility: 'direct' });
    const ref = { ...DM_REF, target: null };
    const state = appReducer(dmState(), {
      type: 'windows',
      action: { type: 'open', ref, title: 'dm/-' },
    });
    const { context } = postContext(state);

    await expect(post({ text: 'hello' }, dmWindow(state), context)).resolves.toBeNull();
  });

  it('says to log in when its window has no account to post as', async () => {
    // No handler is registered: any request would fail the test.
    const ref = { ...DM_REF, accountKey: null };
    const state = appReducer(dmState(), {
      type: 'windows',
      action: { type: 'open', ref, title: 'dm/alice@other.example' },
    });
    const { context, dispatch } = postContext(state);

    await expect(post({ text: 'hello' }, dmWindow(state), context)).resolves.toBe(
      'Not logged in. Type /connect',
    );

    expect(dispatch).not.toHaveBeenCalled();
  });
});
