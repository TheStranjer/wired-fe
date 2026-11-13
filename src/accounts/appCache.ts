/**
 * The per-instance OAuth app cache (decision 8): the first login to an
 * instance registers WiredFE with `POST /api/v1/apps`, and the returned client
 * credentials are stored under `"<origin> <redirectUri>"` in the given
 * {@link Store}. Every later login with the same origin and redirect URI reads
 * them back without a request; {@link forgetApp} drops an entry when the
 * instance rejects the stored client. Reads are validated, so a corrupt value
 * causes a fresh registration instead of reaching the login flow.
 */

import * as v from 'valibot';

import type { ApiError } from '../api/errors';
import { type AppCredentials, registerApp } from '../api/oauth';
import { type Result, ok } from '../lib/result';
import type { Store } from '../storage/store';

/** A cached registration: the two credential strings, anything else misses. */
const CachedAppSchema: v.GenericSchema<unknown, AppCredentials> = v.object({
  client_id: v.string(),
  client_secret: v.string(),
});

/** The cache key for one instance and redirect URI: the two joined by a space. */
function cacheKey(origin: string, redirectUri: string): string {
  return `${origin} ${redirectUri}`;
}

/**
 * The app credentials to log in with: the cached registration for this origin
 * and redirect URI when one is stored and valid (no request at all), else a
 * fresh {@link registerApp}. A successful registration is stored; a failed one
 * leaves the cache untouched.
 */
export async function getOrRegisterApp(
  store: Store,
  params: { readonly origin: string; readonly redirectUri: string; readonly appName: string },
): Promise<Result<AppCredentials, ApiError>> {
  const key = cacheKey(params.origin, params.redirectUri);
  const cached = store.get(key, CachedAppSchema);
  if (cached !== undefined) {
    return ok(cached);
  }

  const registered = await registerApp(params.origin, {
    appName: params.appName,
    redirectUri: params.redirectUri,
  });
  if (registered.ok) {
    store.set(key, registered.value);
  }
  return registered;
}

/**
 * Drops the cached registration for one instance and redirect URI, so the
 * next {@link getOrRegisterApp} registers again. Used when an instance rejects
 * the stored client; removing an absent entry is a no-op.
 */
export function forgetApp(
  store: Store,
  params: { readonly origin: string; readonly redirectUri: string },
): void {
  store.remove(cacheKey(params.origin, params.redirectUri));
}
