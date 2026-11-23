/**
 * The signed-in DM window the direct-message tests share (AGENTS.md
 * "Testing"): lain's account and one `dm` window keyed to alice's handle, as
 * /query opens it, built through the real reducers so a hook or a kind sees
 * exactly what the app would have shown it, plus the conversation fixtures
 * {@link serveDirect} answers the load with over MSW: alice's unread
 * one-on-one conversation with its thread around the last word, and a group
 * one, bob's and an empty one for the load to look past. The read marks are
 * recorded, not assumed. No handler answers what a test never served.
 */
import { HttpResponse, http } from 'msw';

import { status, TEST_DATE } from './fixtures';
import { server } from './server';
import { type StoredAccount, accountKey } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import type { ApiSession } from '../api/session';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import type { WindowRef } from '../windows/model';
import { windowId } from '../windows/model';

/** The instance a DM test signs in to and is answered by. */
export const ORIGIN = 'https://wired.example';

/** lain: the account the DM window belongs to and fetches with. */
const DM_ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The normalized handle alice's conversation is keyed by, as /query leaves it. */
export const DM_TARGET = 'alice@other.example';

/** Alice's DM window, its id, and the id of the same ref without a target. */
export const DM_REF: WindowRef = { kind: 'dm', accountKey: DM_ACCOUNT.key, target: DM_TARGET };
export const DM_WINDOW = windowId(DM_REF);
export const DM_TARGETLESS = windowId({ ...DM_REF, target: null });

/** The session every served fetch arrives through. */
export const DM_SESSION: ApiSession = { origin: ORIGIN, token: 'never-logged' };

/** The account shape the schemas accept, named by {@link acct} alone. */
export function wireAccount(id: string, acct: string): Record<string, unknown> {
  return {
    id,
    username: acct.split('@')[0] ?? acct,
    acct,
    display_name: '',
    created_at: TEST_DATE,
    note: '',
    url: `https://other.example/@${id}`,
    avatar: 'https://other.example/avi.png',
    header: 'https://other.example/banner.png',
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
  };
}

/** A conversation between {@link accounts}, whose last word is {@link said}. */
export function wireConversation(
  id: string,
  accounts: readonly unknown[],
  said: Status | null,
): Record<string, unknown> {
  return { id, accounts, unread: true, last_status: said };
}

/** alice, on somebody else's instance: the person the window talks to. */
export const ALICE = wireAccount('9', 'alice@other.example');
/** bob, on the same instance: the third party the load looks past. */
const BOB = wireAccount('10', 'bob@other.example');

/** The thread the load fetches around alice's last word, oldest first: 5, 6, 7, 8. */
const LAIN_LAST = status('5', { visibility: 'direct', content: '<p>close the world</p>' });
const ALICE_ABOVE = status('6', {
  account: ALICE,
  visibility: 'direct',
  content: '<p>hello?</p>',
});
export const ALICE_LAST = status('7', {
  account: ALICE,
  visibility: 'direct',
  content: '<p>present time</p>',
});
export const ALICE_REPLY = status('8', {
  account: ALICE,
  visibility: 'direct',
  content: '<p>clones drift away</p>',
});

/** What the window shows after a served load, top to bottom: that order. */
export const ALICE_THREAD: readonly Status[] = [LAIN_LAST, ALICE_ABOVE, ALICE_LAST, ALICE_REPLY];

/** alice's conversation on page one; the others the load must look past. */
export const ALICE_CONVERSATION = wireConversation('c1', [ALICE], ALICE_LAST);
export const GROUP_CONVERSATION = wireConversation('c2', [ALICE, BOB], ALICE_LAST);
export const BOB_CONVERSATION = wireConversation('c3', [BOB], null);
export const EMPTY_CONVERSATION = wireConversation('c4', [ALICE], null);

/** What a served DM load may refuse instead of answering. */
export type ServeDirect = {
  /** The conversation pages, first served first; the last one repeats. */
  readonly pages?: readonly (readonly unknown[])[];
  /** Refuse every conversation list request. */
  readonly listFail?: boolean;
  /** Refuse the context request for alice's last word. */
  readonly contextFail?: boolean;
};

/**
 * Answer the DM load: alice's conversation on its first page unless the test
 * brings its own {@link ServeDirect.pages}, the thread around her last word,
 * and the read mark for conversation `c1`. Answers the conversation list
 * with a `next` link while a further page is waiting, and resolves to the
 * ids the load marked read.
 */
export function serveDirect(serve: ServeDirect = {}): readonly string[] {
  const marked: string[] = [];
  const pages = serve.pages ?? [[ALICE_CONVERSATION]];
  let asked = 0;
  server.use(
    http.get(`${ORIGIN}/api/v1/conversations`, () => {
      if (serve.listFail === true) {
        return HttpResponse.json({ error: 'Boom' }, { status: 500 });
      }
      const items = pages[Math.min(asked, pages.length - 1)] ?? [];
      asked += 1;
      return HttpResponse.json(items, {
        headers:
          pages.length > asked
            ? { link: `<${ORIGIN}/api/v1/conversations?max_id=z>; rel="next"` }
            : {},
      });
    }),
    http.get(`${ORIGIN}/api/v1/statuses/7/context`, () => {
      return serve.contextFail === true
        ? HttpResponse.json({ error: 'No context' }, { status: 404 })
        : HttpResponse.json({ ancestors: [LAIN_LAST, ALICE_ABOVE], descendants: [ALICE_REPLY] });
    }),
    http.post(`${ORIGIN}/api/v1/conversations/c1/read`, () => {
      marked.push('c1');
      return HttpResponse.json(ALICE_CONVERSATION);
    }),
  );
  return marked;
}

/** The signed-in state with alice's DM window open; {@link loaded} pre-loads it. */
export function dmState(loaded = false): AppState {
  const withWindow = coreReducer(
    coreReducer(initialAppState(), {
      type: 'accounts',
      accounts: [DM_ACCOUNT],
      activeKey: DM_ACCOUNT.key,
    }),
    { type: 'windows', action: { type: 'open', ref: DM_REF, title: 'dm/alice@other.example' } },
  );
  return loaded
    ? appReducer(withWindow, { type: 'load', windowId: DM_WINDOW, load: 'loaded' })
    : withWindow;
}

/** {@link state} with a second DM window open, this one with nothing to target. */
export function withTargetless(state: AppState): AppState {
  return coreReducer(state, {
    type: 'windows',
    action: { type: 'open', ref: { ...DM_REF, target: null }, title: 'dm/-' },
  });
}

/** The DM window over {@link state}, showing {@link posts} as an API page does. */
export function showing(state: AppState, posts: readonly Status[]): AppState {
  return appReducer(state, {
    type: 'statuses',
    windowId: DM_WINDOW,
    statuses: posts,
    where: 'newer',
  });
}
