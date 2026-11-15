/**
 * Tests for the shared account-target resolver: a handle looked up through
 * the MSW-backed lookup endpoint, a failed lookup reported by the handle it
 * asked for, the author of the post a label names, the boosted author of a
 * boost, the author of the selected post, and the refusals for nothing
 * selected, an unknown label and no session.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { resolveAccountTarget } from './targets';
import type { CommandContext } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import { AccountSchema } from '../api/schemas/account';
import type { Status } from '../api/schemas/status';
import type { ApiSession } from '../api/session';
import { err, ok } from '../lib/result';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { fakeCommandContext } from '../test/commandContext';
import { status, TEST_DATE } from '../test/fixtures';
import { server } from '../test/server';
import { type WindowRef, windowId } from '../windows/model';

const ORIGIN = 'https://wired.example';

/** The signed-in account every acting test runs as. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
};

/** The session the resolver hands back for {@link LAIN}. */
const SESSION: ApiSession = { origin: ORIGIN, token: 'token' };

/** Lain's home window: the active window the resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** The twelve fields every backend sends for remote nine, and the parsed account. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '<p>not lain</p>',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 3,
  following_count: 4,
  statuses_count: 5,
};

const NINE = v.parse(AccountSchema, NINE_WIRE);

const ALPHA = status('a');

/** A post by nine, so its author differs from the fixture author, lain. */
const BY_NINE = status('n', { account: NINE_WIRE });

/** A boost by lain of nine's post: booster lain, boosted author nine. */
const BOOST = status('boost', { reblog: BY_NINE });

/**
 * The signed-in state with lain's home window open, showing {@link posts}
 * (API order, newest first) and {@link selectedId} selected when one is given.
 */
function homeState(posts: readonly Status[], selectedId: string | null): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signedIn, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
  if (selectedId === null) {
    return filled;
  }
  return appReducer(filled, { type: 'select', windowId: HOME_ID, key: `post:${selectedId}` });
}

/** A context whose active window shows {@link posts}, {@link selectedId} selected. */
function homeContext(posts: readonly Status[], selectedId: string | null = null): CommandContext {
  const state = homeState(posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}

describe(resolveAccountTarget, () => {
  it('looks up a handle and keeps what follows', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('acct')).toBe('nine@pleroma.example');

        return HttpResponse.json(NINE_WIRE);
      }),
    );

    const result = await resolveAccountTarget('@nine@pleroma.example say hi', homeContext([]));

    expect(result).toStrictEqual(
      ok({ account: NINE, rest: 'say hi', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('reports a failed lookup by the handle it asked for', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await resolveAccountTarget('nine@pleroma.example', homeContext([]));

    expect(result).toStrictEqual(
      err('No account nine@pleroma.example: HTTP 404: Record not found'),
    );
  });

  it('takes the author of the post a label names', async () => {
    const result = await resolveAccountTarget('a0 note', homeContext([BY_NINE]));

    expect(result).toStrictEqual(
      ok({ account: NINE, rest: 'note', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('takes the boosted author of a boost, not the booster', async () => {
    const result = await resolveAccountTarget('a0', homeContext([BOOST]));

    expect(result).toStrictEqual(
      ok({ account: NINE, rest: '', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('takes the author of the selected post and keeps all of args', async () => {
    const context = homeContext([BY_NINE, ALPHA], 'n');

    const result = await resolveAccountTarget('hello', context);

    expect(result).toStrictEqual(
      ok({ account: NINE, rest: 'hello', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('refuses when nothing is selected to fall back to', async () => {
    const result = await resolveAccountTarget('', homeContext([BY_NINE, ALPHA]));

    expect(result).toStrictEqual(err('Select a post first (j/k) or give a label'));
  });

  it('refuses a label this window never gave', async () => {
    const result = await resolveAccountTarget('z9', homeContext([BY_NINE]));

    expect(result).toStrictEqual(err('No post z9 here'));
  });

  it('refuses while nobody is signed in, before asking the network', async () => {
    // No handler is registered: any request would fail this test.
    const result = await resolveAccountTarget('@someone@else.example hi', fakeCommandContext());

    expect(result).toStrictEqual(err('Not logged in. Type /connect'));
  });
});
