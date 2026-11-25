/**
 * The desk sync's two calls (decision 17): read and write the settings store
 * of one signed-in account. The shell's layer may not reach the API client
 * itself, so this slice does it for the sync engine, with the account's own
 * token and nothing else. What the server answers, and how it fails, is the
 * endpoint module's: see `src/api/endpoints/settingsStore`.
 */
import type { StoredAccount } from '../../accounts/accountStore';
import { getSettingsStore, patchSettingsStore } from '../../api/endpoints/settingsStore';
import type { SettingsStoreError } from '../../api/endpoints/settingsStore';
import type { SettingsStore } from '../../api/schemas/settingsStore';
import type { ApiSession } from '../../api/session';
import type { Result } from '../../lib/result';

export type { SettingsStoreError };

/** What the settings store answered: the stored object, or why not. */
type SettingsAnswer = Result<SettingsStore, SettingsStoreError>;

/** The session {@link account} signs with. */
function sessionOf(account: StoredAccount): ApiSession {
  return { origin: account.origin, token: account.token };
}

/** The object {@link account}'s server keeps for WiredFE; `{}` when nothing was saved. */
export async function readSettings(account: StoredAccount): Promise<SettingsAnswer> {
  return await getSettingsStore(sessionOf(account));
}

/**
 * Merges {@link patch} into what {@link account}'s server keeps (the server
 * deep-merges; arrays replace) and answers the merged object.
 */
export async function writeSettings(
  account: StoredAccount,
  patch: Readonly<Record<string, unknown>>,
): Promise<SettingsAnswer> {
  return await patchSettingsStore(sessionOf(account), patch);
}
