/**
 * Beginning an OAuth login (decision 8): get or register this instance's app,
 * generate an unguessable `state`, remember it as the pending login, and hand
 * back the authorize URL. The caller navigates; this module only builds the
 * URL, so the flow stays testable without a browser.
 */

import { getOrRegisterApp } from './appCache';
import { type PendingLogin, savePendingLogin } from './pendingLogin';
import type { ApiError } from '../api/errors';
import { OAUTH_SCOPES } from '../api/oauth';
import { type Result, ok } from '../lib/result';
import type { Store } from '../storage/store';

/**
 * Fill `bytes` with cryptographically random values, in place. The draw
 * happens in a fresh `ArrayBuffer`-backed array because that is what
 * {@link Crypto.getRandomValues} accepts in this TypeScript version; the
 * caller's buffer receives the values and is what comes back.
 */
function defaultRandom(bytes: Uint8Array): Uint8Array {
  bytes.set(crypto.getRandomValues(new Uint8Array(bytes.length)));
  return bytes;
}

/** The state's 16 random bytes as 32 lowercase hex characters. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The anti-CSRF `state` for one login: 32 lowercase hex characters from 16
 * bytes of {@link crypto}.{@link getRandomValues} — or of the injected
 * {@link random} source, which receives a 16-byte buffer to fill.
 */
export function createState(random: (bytes: Uint8Array) => Uint8Array = defaultRandom): string {
  return toHex(random(new Uint8Array(16)));
}

/**
 * The instance's authorize page URL for one client: `<origin>/oauth/authorize`
 * with the authorization-code parameters (response_type, client_id,
 * redirect_uri, scope, state), each form-encoded by
 * {@link URLSearchParams}.{@link searchParams}.
 */
export function authorizeUrl(params: {
  readonly origin: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
}): string {
  const url = new URL('/oauth/authorize', params.origin);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', OAUTH_SCOPES);
  url.searchParams.set('state', params.state);
  return url.toString();
}

/**
 * Start a login on the instance at `origin`: reuse or register its app in
 * `stores.apps` (a registration failure is returned as-is, saving nothing),
 * create a state, store it in `stores.login` as the pending login created at
 * `now`, and return the authorize URL for the caller to navigate to.
 */
export async function beginLogin(
  stores: { readonly apps: Store; readonly login: Store },
  params: {
    readonly origin: string;
    readonly redirectUri: string;
    readonly appName: string;
    readonly now: number;
  },
): Promise<Result<string, ApiError>> {
  const registered = await getOrRegisterApp(stores.apps, params);
  if (!registered.ok) {
    return registered;
  }

  const pending: PendingLogin = {
    origin: params.origin,
    state: createState(),
    redirectUri: params.redirectUri,
    createdAt: params.now,
  };
  savePendingLogin(stores.login, pending);
  return ok(
    authorizeUrl({
      origin: params.origin,
      clientId: registered.value.client_id,
      redirectUri: params.redirectUri,
      state: pending.state,
    }),
  );
}
