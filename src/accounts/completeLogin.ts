/**
 * Completing an OAuth login (decision 8): the browser is back from the
 * instance's authorize page with a query string, and this module turns it
 * into a stored, active account. The callback must be one, a pending login
 * started here must still be unexpired, and its `state` must match the
 * callback's (the CSRF check); only then is the cached app used to exchange
 * the code, the new token verified against `verify_credentials`, and the
 * account stored — which makes it active. Every API failure goes through
 * {@link failed}, which clears the pending login so one code is never tried
 * twice; an expired or absent pending login is left where it is. The caller
 * strips the query from the URL: nothing here touches `window`.
 */

import type { AccountStore, StoredAccount } from './accountStore';
import { getOrRegisterApp } from './appCache';
import { parseCallback } from './callback';
import { fullHandle } from './handle';
import { type PendingLogin, clearPendingLogin, readPendingLogin } from './pendingLogin';
import { verifyCredentials } from '../api/endpoints/accountRead';
import { type ApiError, describeApiError } from '../api/errors';
import { exchangeCode } from '../api/oauth';
import type { Account } from '../api/schemas/account';
import { type Result, err, ok } from '../lib/result';
import type { Store } from '../storage/store';

/** What completing (or refusing) a login produced for the caller to show. */
export type LoginOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok'; readonly account: StoredAccount }
  | { readonly kind: 'error'; readonly message: string };

/** The three stores the flow reads: app cache, pending logins, accounts. */
type LoginStores = {
  readonly apps: Store;
  readonly login: Store;
  readonly accounts: AccountStore;
};

/** A callback whose state matched the pending login it belongs to. */
type Accepted = { readonly pending: PendingLogin; readonly code: string };

/** A finished exchange: the access token and the account it proves. */
type Verification = { readonly account: Account; readonly token: string };

/** Shown when a callback arrives with no (or an expired) pending login. */
const EXPIRED_MESSAGE = 'Login expired or was not started here. Try again.';

/** Shown when the callback's `state` is not the one this browser sent. */
const MISMATCH_MESSAGE = 'Login state did not match. Try again.';

/**
 * The callback and pending-login checks (behaviours 1–4): `ok` with the
 * pending login and the code to exchange once every check passes; `err`
 * with the outcome to return — and the pending login already cleared by
 * the checks that say so.
 */
function checkCallback(
  stores: LoginStores,
  params: { readonly search: string; readonly now: number },
): Result<Accepted, LoginOutcome> {
  const callback = parseCallback(params.search);
  if (callback === null) {
    return err({ kind: 'none' });
  }
  if (callback.kind === 'error') {
    clearPendingLogin(stores.login);
    const reason = callback.description ?? callback.error;
    return err({ kind: 'error', message: `Login refused: ${reason}` });
  }

  const pending = readPendingLogin(stores.login, params.now);
  if (pending === null) {
    return err({ kind: 'error', message: EXPIRED_MESSAGE });
  }
  if (pending.state !== callback.state) {
    clearPendingLogin(stores.login);
    return err({ kind: 'error', message: MISMATCH_MESSAGE });
  }
  return ok({ pending, code: callback.code });
}

/**
 * The API leg (behaviour 5): the pending origin's cached app (a hit is
 * expected; a miss registers it now), its token exchange for the callback's
 * code, and one `verify_credentials` call with the fresh token. The first
 * failure is returned as-is, as an `Err` of the shared {@link ApiError}.
 */
async function exchange(input: {
  readonly apps: Store;
  readonly pending: PendingLogin;
  readonly code: string;
  readonly appName: string;
}): Promise<Result<Verification, ApiError>> {
  const app = await getOrRegisterApp(input.apps, {
    origin: input.pending.origin,
    redirectUri: input.pending.redirectUri,
    appName: input.appName,
  });
  if (!app.ok) {
    return app;
  }

  const token = await exchangeCode(input.pending.origin, {
    app: app.value,
    code: input.code,
    redirectUri: input.pending.redirectUri,
  });
  if (!token.ok) {
    return token;
  }

  const verified = await verifyCredentials({
    origin: input.pending.origin,
    token: token.value.access_token,
  });
  return verified.ok ? ok({ account: verified.value, token: token.value.access_token }) : verified;
}

/**
 * Clear the pending login and hand back the `Login failed` outcome for
 * {@link error}: every API refusal of the exchange leg ends here, so a
 * half-finished login leaves nothing to retry with.
 */
function failed(login: Store, error: ApiError): LoginOutcome {
  clearPendingLogin(login);
  return { kind: 'error', message: `Login failed: ${describeApiError(error)}` };
}

/** The stored record for a verified account: where, who, and its new token. */
function toAdd(pending: PendingLogin, account: Account, token: string): Omit<StoredAccount, 'key'> {
  return {
    origin: pending.origin,
    accountId: account.id,
    handle: fullHandle(account, pending.origin),
    token,
  };
}

/**
 * The exchange-and-store leg (behaviours 5 and 6): {@link exchange}, then
 * storing the verified account — which makes it active — and clearing the
 * pending login; any API failure goes through {@link failed}.
 */
async function finishLogin(
  stores: LoginStores,
  accepted: Accepted,
  appName: string,
): Promise<LoginOutcome> {
  const verified = await exchange({
    ...accepted,
    apps: stores.apps,
    appName,
  });
  if (!verified.ok) {
    return failed(stores.login, verified.error);
  }

  const account = stores.accounts.add(
    toAdd(accepted.pending, verified.value.account, verified.value.token),
  );
  clearPendingLogin(stores.login);
  return { kind: 'ok', account };
}

/**
 * Complete the OAuth callback {@link params.search} describes, if the URL
 * carries one (behaviours 1–6): check it against the pending login,
 * exchange the code, verify the token, and store the account. Returns
 * `{ kind: 'none' }` when the query is not a callback at all, so the caller
 * can ignore ordinary page loads; `now` is the clock the pending login's
 * TTL is judged against, and `appName` names a first registration of this
 * instance's app. Never touches `window`.
 */
export async function completeLogin(
  stores: LoginStores,
  params: { readonly search: string; readonly appName: string; readonly now: number },
): Promise<LoginOutcome> {
  const accepted = checkCallback(stores, params);
  if (!accepted.ok) {
    return accepted.error;
  }
  return finishLogin(stores, accepted.value, params.appName);
}
