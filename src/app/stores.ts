/**
 * The application's persisted stores (decision 8, decision 10): the five
 * namespaces a command reaches through its context — the OAuth apps it has
 * registered, the login in flight, the signed-in accounts, the reader's
 * settings and the instance profiles detected this session — each in its own
 * namespace, on top of `localStorage` (the profiles on `sessionStorage`). They are
 * created once, on first use, and shared by every mount: the storage module is
 * stateless by design, so one store per namespace is all the app ever needs.
 */

import { createAccountStore } from '../accounts/accountStore';
import { createSyncStore } from '../accounts/syncPrefs';
import type { CommandContext } from '../commands/types';
import { createSessionStore, createStore } from '../storage/store';

/** The stores the command context carries: one per namespace this app owns. */
export type AppStores = CommandContext['stores'];

/** The created stores; undefined until someone first asks for them. */
let cached: AppStores | undefined;

/** The four stores, each in the namespace its owner chose. */
function create(): AppStores {
  return {
    apps: createStore('apps'),
    login: createStore('login'),
    accounts: createAccountStore(createStore('accounts')),
    settings: createStore('settings'),
    sync: createSyncStore(createStore('sync')),
    profiles: createSessionStore('profiles'),
  };
}

/**
 * The persisted stores a command may read and write, created on the first call
 * and shared from then on.
 */
export function appStores(): AppStores {
  const created = cached;
  if (created !== undefined) {
    return created;
  }
  const fresh = create();
  cached = fresh;
  return fresh;
}
