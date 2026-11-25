/**
 * Which account holds the synced desk (decision 17), as a pure choice over the
 * user's {@link SyncPrefs} and what the app knows: the first listed account
 * that is signed in, not expired, and whose instance has the `settingsStore`
 * capability. With nothing listed, the first such account in sign-in order.
 * Sync switched off picks nothing. {@link skipReason} says why an account
 * cannot be used, so `/sync` can explain what it skipped.
 */

import type { AppState } from './appState';
import type { SyncPrefs } from '../accounts/syncPrefs';

/** The slice of the app state a choice reads. */
export type SyncWorld = Pick<AppState, 'accounts' | 'profiles' | 'expired'>;

/**
 * Why the account with {@link key} cannot hold the synced desk, or null when
 * it can: it is not signed in, its session expired, or its instance has no
 * settings store (or is not detected yet).
 */
export function skipReason(key: string, world: SyncWorld): string | null {
  const account = world.accounts.find((candidate) => candidate.key === key);
  if (account === undefined) {
    return 'not signed in';
  }
  if (world.expired.has(key)) {
    return 'session expired';
  }
  const profile = world.profiles.get(account.origin);
  return profile?.capabilities.features.has('settingsStore') === true ? null : 'no settings store';
}

/** The key of the account that holds the synced desk, or null when none can. */
export function pickSyncAccount(prefs: SyncPrefs, world: SyncWorld): string | null {
  if (!prefs.syncEnabled) {
    return null;
  }
  const keys =
    prefs.syncAccounts.length === 0
      ? world.accounts.map((account) => account.key)
      : prefs.syncAccounts;
  return keys.find((key) => skipReason(key, world) === null) ?? null;
}
