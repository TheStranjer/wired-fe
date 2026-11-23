/**
 * The signed-in home window the post commands' tests share (AGENTS.md
 * "Testing"): lain's account and one home window whose scrollback shows the
 * statuses a test is given — API order, newest first — with the labels, the
 * selection and the session the target resolver reads. Building it through the
 * real reducer means a command sees exactly what the app would have shown it.
 * {@link serveStatusActions} and {@link serveAccountActions} stand in for the
 * instance on the other side, and {@link FOREIGN_WIRE} is an account of
 * somebody else's, for the tests that need a post the acting account does not
 * own.
 */

import { type HttpHandler, HttpResponse, http } from 'msw';

import { fakeCommandContext } from './commandContext';
import { TEST_DATE } from './fixtures';
import { server } from './server';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import type { CommandContext } from '../commands/types';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { type WindowRef, windowId } from '../windows/model';

/** The instance a home-window test signs in to and is answered by. */
export const ORIGIN = 'https://wired.example';

/** lain: the signed-in account whose home window shows the posts. */
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

const HOME_ID = windowId(HOME);

/** The twelve fields every backend sends for an account that is not lain's. */
export const FOREIGN_WIRE = {
  id: '2',
  username: 'smiling',
  acct: 'smiling@wired.example',
  display_name: 'Smiling Man',
  created_at: TEST_DATE,
  note: '',
  url: 'https://wired.example/@smiling',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/**
 * A command context over the signed-in home window showing {@link posts} (API
 * order, newest first), the selection standing on {@link selectedId} when one
 * is given.
 */
export function homeContext(
  posts: readonly Status[],
  selectedId: string | null = null,
): CommandContext {
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
  const state =
    selectedId === null
      ? filled
      : appReducer(filled, { type: 'select', windowId: HOME_ID, key: `post:${selectedId}` });
  return fakeCommandContext({ state, windows: state.windows });
}

/**
 * The eight status action endpoints as one handler: every POST to
 * `/api/v1/statuses/<id>/<action>` is answered with {@link body} — a status
 * object is a valid answer, the same schema reads it back — and its pathname
 * recorded. The returned list is what the instance was asked for, in order.
 */
export function serveStatusActions(body: Status): string[] {
  const paths: string[] = [];
  const handler: HttpHandler = http.post(`${ORIGIN}/api/v1/statuses/:id/:action`, ({ request }) => {
    paths.push(new URL(request.url).pathname);

    return HttpResponse.json(body);
  });
  server.use(handler);
  return paths;
}

/** One account action the instance was asked for: its path and JSON body. */
type AccountActionCall = {
  readonly path: string;
  /** The parsed body, or undefined when the request went out with none. */
  readonly body: unknown;
};

/**
 * The six account action endpoints as one handler: every POST to
 * `/api/v1/accounts/<id>/<action>` is answered with {@link relationship} — a
 * relationship object is a valid answer, the same schema reads it back — and
 * the call recorded: its pathname and parsed body, `undefined` for the
 * requests that carry none. The returned list is what the instance was asked
 * for, in order.
 */
export function serveAccountActions(relationship: Record<string, unknown>): AccountActionCall[] {
  const calls: AccountActionCall[] = [];
  const handler: HttpHandler = http.post(
    `${ORIGIN}/api/v1/accounts/:id/:action`,
    async ({ request }) => {
      const text = await request.text();

      calls.push({
        path: new URL(request.url).pathname,
        body: text === '' ? undefined : JSON.parse(text),
      });

      return HttpResponse.json(relationship);
    },
  );
  server.use(handler);
  return calls;
}
