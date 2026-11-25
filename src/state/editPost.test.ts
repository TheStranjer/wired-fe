/**
 * Tests for saving an edit from the edit composer (WFE-268): the account's
 * session PUTs the new text and content warning over what the post keeps
 * (media, sensitivity, poll), an empty warning clears it, the answered status
 * is dispatched for every buffer, a refusal comes back as the message to show
 * with nothing dispatched, and a closed poll or a missing account asks the
 * network for nothing. The note and the label name the post by the line a
 * window gave it.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { type AppState, coreReducer, initialAppState, printAction } from './appState';
import { editedNote, editPost, postLabel } from './editPost';
import { appReducer } from './reducer';
import type { PostContext } from './windowKind';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';
import { TEST_DATE, status } from '../test/fixtures';
import { server } from '../test/server';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';

/** The account the edit goes out as, and the window that shows the post. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };
const HOME_ID = windowId(HOME);

/** Lain's post, with a picture, as the home window shows it. */
const MINE = status('p', {
  spoiler_text: 'old warning',
  media_attachments: [{ id: 'm1', type: 'image', url: `${ORIGIN}/m1.png` }],
});

/** The post as the instance answers the PUT. */
const EDITED = status('p', { content: '<p>new</p>', edited_at: TEST_DATE });

/** The state signed in as {@link ACCOUNT}, home window showing {@link posts}. */
function signedIn(posts: readonly Status[] = [MINE]): AppState {
  const accounts = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  const opened = coreReducer(accounts, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  return appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
}

/** A post context over {@link state} and the dispatch it records asks for; with a refresh seam when asked. */
function contextFor(
  state: AppState,
  refreshing = false,
): Pick<PostContext, 'state' | 'dispatch' | 'refresh'> {
  const dispatch = vi.fn<PostContext['dispatch']>();
  return refreshing
    ? { state, dispatch, refresh: { refresher: null, dispatch, getState: () => state } }
    : { state, dispatch };
}

/** The PUT of the post, collecting its JSON body and answering {@link answer}. */
function servePut(answer: Response): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.put(`${ORIGIN}/api/v1/statuses/p`, async ({ request }) => {
      bodies.push(await request.json());

      expect(request.headers.get('Authorization')).toBe('Bearer never-logged');

      return answer.clone();
    }),
  );
  return bodies;
}

/** The moment the edit is sent. */
const NOW = new Date(TEST_DATE);

describe(editPost, () => {
  it('sends the new text and warning with the media the post keeps, and dispatches the answer', async () => {
    const bodies = servePut(HttpResponse.json(EDITED));
    const context = contextFor(signedIn(), true);

    const result = await editPost(context, ACCOUNT.key, {
      status: MINE,
      draft: { text: 'new', spoilerText: 'new warning' },
      now: NOW,
    });

    expect(result).toStrictEqual({ ok: true, value: EDITED });
    expect(bodies).toStrictEqual([
      { status: 'new', spoiler_text: 'new warning', sensitive: false, media_ids: ['m1'] },
    ]);
    expect(context.dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'statusUpdated',
      status: EDITED,
    });
  });

  it('clears the warning when the draft has none', async () => {
    const bodies = servePut(HttpResponse.json(EDITED));

    await editPost(contextFor(signedIn()), ACCOUNT.key, {
      status: MINE,
      draft: { text: 'new' },
      now: NOW,
    });

    expect(bodies).toStrictEqual([
      { status: 'new', spoiler_text: '', sensitive: false, media_ids: ['m1'] },
    ]);
  });

  it('returns what the instance’s refusal says and dispatches nothing', async () => {
    servePut(HttpResponse.json({ error: 'boom' }, { status: 500 }));
    const context = contextFor(signedIn());

    const result = await editPost(context, ACCOUNT.key, {
      status: MINE,
      draft: { text: 'new' },
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('HTTP 500');
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a post whose poll has closed before any request', async () => {
    const closed = status('p', {
      poll: {
        id: 'poll1',
        expires_at: null,
        expired: true,
        multiple: false,
        votes_count: 0,
        options: [{ title: 'yes', votes_count: 0 }],
      },
    });

    const result = await editPost(contextFor(signedIn()), ACCOUNT.key, {
      status: closed,
      draft: { text: 'new' },
      now: NOW,
    });

    expect(result).toStrictEqual({
      ok: false,
      error: "Can't edit a post whose poll has closed",
    });
  });

  it('says to log in when no account stands behind the edit', async () => {
    const result = await editPost(contextFor(signedIn()), null, {
      status: MINE,
      draft: { text: 'new' },
      now: NOW,
    });

    expect(result).toStrictEqual({ ok: false, error: NOT_LOGGED_IN_MESSAGE });
  });
});

describe(postLabel, () => {
  it('is the label a window gave the post, also through a boost', () => {
    const boosted = signedIn([status('b', { reblog: MINE })]);

    expect(postLabel(signedIn(), MINE)).toBe('a0');
    expect(postLabel(boosted, MINE)).toBe('a0');
  });

  it('passes the lines of other posts and client messages', () => {
    const crowded = appReducer(signedIn([status('o'), MINE]), printAction(HOME_ID, 'info', 'hi'));

    expect(postLabel(crowded, MINE)).toBe('a0');
  });

  it('is the bare id for a post no window shows', () => {
    expect(postLabel(signedIn(), status('zz'))).toBe('zz');
  });
});

describe(editedNote, () => {
  it('prints the edited line under the post’s label', () => {
    expect(editedNote(signedIn(), MINE)).toBe('✎ edited [a0]');
  });
});
