/**
 * Telling WiredFE's own login apart from a third-party app's (WFE-177,
 * decision 8): on a same-origin build `/connect` sends the browser to the
 * instance's `/oauth/authorize` with WiredFE's own cached app, and wired-be
 * hands that request back to the authorization overlay. Once the password
 * login has produced a token there is nothing left to consent to, so the
 * overlay finishes such a request without the authorization box.
 */

import { cachedApp } from '../accounts/appCache';
import { redirectUriFor } from '../accounts/callback';
import { readPendingLogin } from '../accounts/pendingLogin';
import type { Store } from '../storage/store';

/** What the check reads: the app cache, the pending login, the page and the clock. */
export type OwnEnv = {
  readonly apps: Store;
  readonly login: Store;
  readonly page: { readonly origin: string; readonly pathname: string };
  readonly now: number;
};

/**
 * Whether {@link query} is WiredFE's own login at {@link origin}: its
 * `client_id` is the app cached for this origin and page, and it either names
 * this page as its `redirect_uri` or carries the `state` of the pending login
 * started here.
 */
export function isOwnRequest(
  query: Readonly<Record<string, string>>,
  origin: string,
  env: OwnEnv,
): boolean {
  const redirectUri = redirectUriFor(env.page);
  const app = cachedApp(env.apps, { origin, redirectUri });
  if (app === undefined || query['client_id'] !== app.client_id) {
    return false;
  }
  if (query['redirect_uri'] === redirectUri) {
    return true;
  }
  const pending = readPendingLogin(env.login, env.now);
  return pending !== null && pending.origin === origin && pending.state === query['state'];
}
