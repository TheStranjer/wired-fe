/**
 * The app's {@link Refresher} (decision 8): the persisted accounts and OAuth
 * app cache the state layer may not reach itself, the page's redirect URI and
 * the configured app name for a first registration, and the real clock.
 */

import { appStores } from './stores';
import { getOrRegisterApp } from '../accounts/appCache';
import { redirectUriFor } from '../accounts/callback';
import { buildConfig } from '../config/config';
import type { Refresher } from '../state/refreshSession';

/** The refresher over the application's stores and the current page. */
export function appRefresher(): Refresher {
  const stores = appStores();
  return {
    accounts: stores.accounts,
    getApp: async (origin) =>
      await getOrRegisterApp(stores.apps, {
        origin,
        redirectUri: redirectUriFor(window.location),
        appName: buildConfig.appName,
      }),
    now: Date.now,
  };
}
