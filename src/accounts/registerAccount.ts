/**
 * Registering an account from an invite link (decision 8): the instance's app
 * is read from the login's cache (or registered), traded for an app token,
 * and that token creates the account together with the invite token. What
 * comes back is one of four things: a token that proves out against
 * `verify_credentials`, which is stored as a signed-in account the way a login
 * stores one (and made active); or the news that the address must be
 * confirmed or a moderator must approve the account first, which the response
 * says outright or the instance's refusal of the new token does; or an error,
 * with the instance's per-field complaints. The password goes into the one
 * request body and nowhere else: nothing here stores or prints it. Never
 * touches `window`.
 */

import type { AccountStore, StoredAccount } from './accountStore';
import { getOrRegisterApp } from './appCache';
import { toAdd } from './loginRecord';
import { verifyCredentials } from '../api/endpoints/accountRead';
import { type NewAccount, type Registration, createAccount } from '../api/endpoints/registration';
import { type ApiError, type FieldErrors, describeApiError } from '../api/errors';
import { requestAppToken } from '../api/oauth';
import { t } from '../i18n/translate';
import { type Result, err, ok } from '../lib/result';
import type { Store } from '../storage/store';

/** What registering produced for the caller to show. */
export type RegistrationOutcome =
  | { readonly kind: 'ok'; readonly account: StoredAccount }
  | { readonly kind: 'confirmation' }
  | { readonly kind: 'approval' }
  | { readonly kind: 'error'; readonly message: string; readonly fields: FieldErrors };

/** The two stores the flow reads and writes: the app cache and the accounts. */
type RegisterStores = { readonly apps: Store; readonly accounts: AccountStore };

/** Where to register, as which app, and who. */
type RegisterParams = {
  readonly origin: string;
  readonly redirectUri: string;
  readonly appName: string;
  readonly now: number;
  readonly account: NewAccount;
};

/** The error outcome of {@link error}: a one-line message and the fields the instance rejected. */
function failed(
  key: 'accounts.registered_login_failed' | 'accounts.registration_failed',
  error: ApiError,
): RegistrationOutcome {
  const fields = error.kind === 'http' ? (error.details ?? {}) : {};
  return { kind: 'error', message: t(key, { reason: describeApiError(error) }), fields };
}

/** The outcome a refused `verify_credentials` of the new token stands for: the instance's own words decide. */
function refusedOutcome(error: ApiError): RegistrationOutcome {
  const message = error.kind === 'http' && error.status === 403 ? error.message : '';
  if (/approv/iu.test(message)) {
    return { kind: 'approval' };
  }
  if (/confirm/iu.test(message)) {
    return { kind: 'confirmation' };
  }
  return failed('accounts.registered_login_failed', error);
}

/**
 * The token's proof and storage: the account behind it is verified and stored
 * as the active one, or the refusal is read as {@link refusedOutcome}.
 */
async function signIn(
  accounts: AccountStore,
  params: RegisterParams,
  registration: Registration,
): Promise<RegistrationOutcome> {
  const { token } = registration;
  if (token === null) {
    return { kind: 'confirmation' };
  }
  const verified = await verifyCredentials({ origin: params.origin, token: token.access_token });
  if (!verified.ok) {
    return refusedOutcome(verified.error);
  }
  const record = toAdd({ origin: params.origin }, { account: verified.value, token }, params.now);
  return { kind: 'ok', account: accounts.add(record) };
}

/** What the answer itself says is still needed before the account works, or null when it says nothing. */
function pending(registration: Registration): RegistrationOutcome | null {
  if (registration.approvalRequired) {
    return { kind: 'approval' };
  }
  return registration.confirmationRequired ? { kind: 'confirmation' } : null;
}

/** The app token for {@link params}' instance: its cached app, traded under `client_credentials`. */
async function appToken(apps: Store, params: RegisterParams): Promise<Result<string, ApiError>> {
  const app = await getOrRegisterApp(apps, params);
  if (!app.ok) {
    return app;
  }
  const token = await requestAppToken(params.origin, { app: app.value });
  return token.ok ? ok(token.value.access_token) : err(token.error);
}

/**
 * Register {@link params}' account on its instance and say what came of it
 * (see the module comment). `now` is the clock the new token's expiry is
 * worked out from, and `appName` names a first registration of the instance's
 * app.
 */
export async function registerAccount(
  stores: RegisterStores,
  params: RegisterParams,
): Promise<RegistrationOutcome> {
  const authorised = await appToken(stores.apps, params);
  if (!authorised.ok) {
    return failed('accounts.registration_failed', authorised.error);
  }
  const created = await createAccount(params.origin, {
    appToken: authorised.value,
    account: params.account,
  });
  if (!created.ok) {
    return failed('accounts.registration_failed', created.error);
  }
  return pending(created.value) ?? (await signIn(stores.accounts, params, created.value));
}
