/**
 * Logging in with a username and password (decision 8, WFE-168): the
 * instance's app is read from the login's cache (or registered), the
 * credentials are traded for a token under the `password` grant, the token is
 * verified against `verify_credentials`, and the account is stored — which
 * makes it active. The password goes into the one token request and nowhere
 * else: nothing here stores or prints it. Never touches `window`.
 */

import type { AccountStore, StoredAccount } from './accountStore';
import { getOrRegisterApp } from './appCache';
import { toAdd } from './loginRecord';
import { verifyCredentials } from '../api/endpoints/accountRead';
import { type ApiError, describeApiError } from '../api/errors';
import { type Token, requestPasswordToken } from '../api/oauth';
import type { Result } from '../lib/result';
import type { Store } from '../storage/store';

/** What a password login produced for the caller to show. */
export type PasswordOutcome =
  | { readonly kind: 'ok'; readonly account: StoredAccount }
  | { readonly kind: 'error'; readonly message: string };

/** Where to log in, as which app, and as whom. */
type PasswordParams = {
  readonly origin: string;
  readonly redirectUri: string;
  readonly appName: string;
  readonly username: string;
  readonly password: string;
  readonly now: number;
};

/** The token the instance gives {@link params}' credentials, under its cached app. */
async function tokenFor(apps: Store, params: PasswordParams): Promise<Result<Token, ApiError>> {
  const app = await getOrRegisterApp(apps, params);
  if (!app.ok) {
    return app;
  }
  return requestPasswordToken(params.origin, {
    app: app.value,
    username: params.username,
    password: params.password,
  });
}

/** The error outcome for {@link error}: a one-line message with no credentials in it. */
function failed(error: ApiError): PasswordOutcome {
  return { kind: 'error', message: `Login failed: ${describeApiError(error)}` };
}

/**
 * Log in as {@link params}' user and say what came of it (see the module
 * comment). `now` is the clock the token's expiry is worked out from, and
 * `appName` names a first registration of the instance's app.
 */
export async function passwordLogin(
  stores: { readonly apps: Store; readonly accounts: AccountStore },
  params: PasswordParams,
): Promise<PasswordOutcome> {
  const token = await tokenFor(stores.apps, params);
  if (!token.ok) {
    return failed(token.error);
  }
  const verified = await verifyCredentials({
    origin: params.origin,
    token: token.value.access_token,
  });
  if (!verified.ok) {
    return failed(verified.error);
  }
  const record = toAdd(params, { account: verified.value, token: token.value }, params.now);
  return { kind: 'ok', account: stores.accounts.add(record) };
}
