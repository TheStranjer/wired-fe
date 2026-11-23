/**
 * The token-refresh seam (AGENTS.md "Layout": src/api stays I/O-only, so the
 * policy lives here). {@link withFreshToken} runs an API call with an
 * account's session; when the instance answers 401 it trades the stored
 * refresh token for a new pair (once, however many calls were refused at the
 * same time), stores it, tells the app state, and retries the call once. An
 * account with no refresh token, or whose refresh fails, is marked expired
 * and reported once in the status window; the caller gets the original error.
 */

import { type AppState, printAction } from './appState';
import type { AppAction } from './reducer';
import { accountByKey } from './selectors';
import type { AccountStore, StoredAccount } from '../accounts/accountStore';
import type { ApiError } from '../api/errors';
import { type AppCredentials, refreshAccessToken } from '../api/oauth';
import type { ApiSession } from '../api/session';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';
import { type Result, err } from '../lib/result';
import { STATUS_WINDOW_ID } from '../windows/model';

/** What the app layer supplies so a token can be traded: persistence, the OAuth app and the clock. */
export type Refresher = {
  readonly accounts: AccountStore;
  /** The cached OAuth app of an instance, registered when missing. */
  readonly getApp: (origin: string) => Promise<Result<AppCredentials, ApiError>>;
  readonly now: () => number;
};

/** Everything {@link withFreshToken} needs; a null refresher cannot refresh, only expire. */
export type RefreshDeps = {
  readonly refresher: Refresher | null;
  readonly dispatch: (action: AppAction) => void;
  /** The app state as it is right now, not as it was when the caller rendered. */
  readonly getState: () => AppState;
};

/** An API call made with one session. */
export type SessionCall<T> = (session: ApiSession) => Promise<Result<T, ApiError>>;

/** {@link withFreshToken} with the deps and the account already bound. */
export type WithToken = <T>(call: SessionCall<T>) => Promise<Result<T, ApiError>>;

/** The refreshes in flight, by account key: concurrent 401s share one. */
const IN_FLIGHT = new Map<string, Promise<ApiSession | null>>();

/** The account as it is now: the store's record when there is one, else the state's. */
function accountOf(deps: RefreshDeps, key: string): StoredAccount | null {
  return deps.refresher?.accounts.get(key) ?? accountByKey(deps.getState(), key);
}

/** The session an account signs with. */
function sessionOf(account: StoredAccount): ApiSession {
  return { origin: account.origin, token: account.token };
}

/** Mark the account expired and say so, once, in the status window. */
function expire(deps: RefreshDeps, account: StoredAccount): void {
  deps.dispatch({ type: 'accountExpired', accountKey: account.key });
  const text = `Session expired for @${account.handle}. Type /connect to log in again.`;
  deps.dispatch(printAction(STATUS_WINDOW_ID, 'error', text));
}

/** The refresh token's trade: the account's new session, stored and announced; null when it cannot be had. */
async function trade(deps: RefreshDeps, account: StoredAccount): Promise<ApiSession | null> {
  const { refresher } = deps;
  if (refresher === null || account.refreshToken === null) {
    return null;
  }
  const app = await refresher.getApp(account.origin);
  if (!app.ok) {
    return null;
  }
  const answer = await refreshAccessToken(account.origin, {
    app: app.value,
    refreshToken: account.refreshToken,
  });
  if (!answer.ok) {
    return null;
  }
  const { access_token: token, refresh_token: next, expires_in: lifetime } = answer.value;
  const expiresAt = lifetime === null ? null : refresher.now() + lifetime * 1000;
  refresher.accounts.updateTokens(account.key, {
    token,
    refreshToken: next ?? account.refreshToken,
    expiresAt,
  });
  deps.dispatch({
    type: 'accounts',
    accounts: refresher.accounts.list(),
    activeKey: refresher.accounts.activeKey(),
  });
  return { origin: account.origin, token };
}

/**
 * The session to retry with after {@link refused} was turned down: the
 * account's current one when another call already replaced that token, a
 * traded one otherwise, null (and the account expired) when that fails.
 */
async function renew(deps: RefreshDeps, key: string, refused: string): Promise<ApiSession | null> {
  const account = accountOf(deps, key);
  if (account === null || deps.getState().expired.has(key)) {
    return null;
  }
  if (account.token !== refused) {
    return sessionOf(account);
  }
  const traded = await trade(deps, account);
  if (traded === null) {
    expire(deps, account);
  }
  return traded;
}

/** {@link renew}, shared by every call refused on the account at the same time. */
async function renewOnce(
  deps: RefreshDeps,
  key: string,
  refused: string,
): Promise<ApiSession | null> {
  const pending = IN_FLIGHT.get(key);
  if (pending !== undefined) {
    return await pending;
  }
  const started = renew(deps, key, refused).finally(() => {
    IN_FLIGHT.delete(key);
  });
  IN_FLIGHT.set(key, started);
  return await started;
}

/** Whether the instance refused the token itself. */
function isUnauthorized(result: Result<unknown, ApiError>): boolean {
  return !result.ok && result.error.kind === 'http' && result.error.status === 401;
}

/**
 * Run {@link call} with the session of {@link accountKey}. A 401 triggers one
 * refresh and one retry whose answer is returned; when no refresh can be had
 * the account is marked expired and the original answer comes back. Any other
 * outcome passes through untouched.
 */
export async function withFreshToken<T>(
  deps: RefreshDeps,
  accountKey: string,
  call: SessionCall<T>,
): Promise<Result<T, ApiError>> {
  const account = accountOf(deps, accountKey);
  if (account === null) {
    return err({ kind: 'http', status: 401, message: NOT_LOGGED_IN_MESSAGE });
  }
  const first = await call(sessionOf(account));
  if (!isUnauthorized(first)) {
    return first;
  }
  const session = await renewOnce(deps, accountKey, account.token);
  return session === null ? first : await call(session);
}
