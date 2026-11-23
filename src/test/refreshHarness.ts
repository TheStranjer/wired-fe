/**
 * The scaffolding the token-refresh tests share (AGENTS.md "Testing"): a
 * signed-in lain whose token the instance refuses unless it is the good one,
 * the refresh grant counted, the deps that record every action `withFreshToken`
 * asks for, and the status-window lines those actions printed. Served by MSW.
 */
import { HttpResponse, http } from 'msw';
import { vi } from 'vitest';

import { fakeCommandContext } from './commandContext';
import { status } from './fixtures';
import { server } from './server';
import type { AccountStore } from '../accounts/accountStore';
import { getStatus } from '../api/endpoints/statusRead';
import type { ApiError } from '../api/errors';
import type { AppCredentials } from '../api/oauth';
import type { ApiSession } from '../api/session';
import { type Result, ok } from '../lib/result';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import type { RefreshDeps } from '../state/refreshSession';
import { STATUS_WINDOW_ID } from '../windows/model';

export const ORIGIN = 'https://wired.example';
export const EXPIRED_LINE =
  'Session expired for @lain@wired.example. Type /connect to log in again.';
const STATUS_URL = `${ORIGIN}/api/v1/statuses/1`;
const TOKEN_URL = `${ORIGIN}/oauth/token`;
const APP: AppCredentials = { client_id: 'cid', client_secret: 'csecret' };

/** Looks up the OAuth app of an instance. */
type GetApp = (origin: string) => Promise<Result<AppCredentials, ApiError>>;

/** The call under test: the one status, read with whatever session it is given. */
export async function readStatus(session: ApiSession): Promise<Result<unknown, ApiError>> {
  return await getStatus(session, '1');
}

/** Serve the status: 200 for the bearer {@link good}, 401 for any other token. */
export function serveStatus(good: string): void {
  server.use(
    http.get(STATUS_URL, ({ request }) =>
      request.headers.get('Authorization') === `Bearer ${good}`
        ? HttpResponse.json(status('1'))
        : HttpResponse.json({ error: 'The access token is invalid' }, { status: 401 }),
    ),
  );
}

/** Serve the refresh grant, answering {@link answer}, and count its requests. */
export function serveRefresh(answer: () => Response): { readonly requests: () => number } {
  let count = 0;
  server.use(
    http.post(TOKEN_URL, () => {
      count += 1;
      return answer();
    }),
  );
  return { requests: () => count };
}

/** A refresh answer carrying a new pair. */
export function newPair(): Response {
  return HttpResponse.json({
    access_token: 'token-2',
    refresh_token: 'refresh-2',
    expires_in: 3600,
  });
}

/** A signed-in lain, the deps that wrap her, and what they were asked to do. */
export type Setup = {
  readonly deps: RefreshDeps;
  readonly key: string;
  readonly actions: AppAction[];
  readonly accounts: AccountStore;
  readonly getApp: ReturnType<typeof vi.fn<GetApp>>;
};

/** Lain signed in with {@link refreshToken} and the token `token-1`, the clock at one million. */
export function setup(refreshToken: string | null = 'refresh-1'): Setup {
  const { accounts } = fakeCommandContext().stores;
  const added = accounts.add({
    origin: ORIGIN,
    accountId: '1',
    handle: 'lain@wired.example',
    token: 'token-1',
    refreshToken,
    expiresAt: null,
  });
  const getApp = vi.fn<GetApp>();
  getApp.mockResolvedValue(ok(APP));
  const actions: AppAction[] = [];
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: accounts.list(),
    activeKey: added.key,
  });
  const dispatch = (action: AppAction): void => {
    actions.push(action);
    state = appReducer(state, action);
  };
  const refresher = { accounts, getApp, now: () => 1_000_000 };
  return {
    deps: { refresher, dispatch, getState: () => state },
    key: added.key,
    actions,
    accounts,
    getApp,
  };
}

/** The status-window lines the actions printed. */
export function statusLines(actions: readonly AppAction[]): readonly string[] {
  return actions.flatMap((action) =>
    action.type === 'print' && action.windowId === STATUS_WINDOW_ID ? [action.text] : [],
  );
}
