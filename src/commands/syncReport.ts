/**
 * What bare `/sync` prints (decision 17): whether sync is on, the primary and
 * the fallbacks in order, which account holds the synced desk now, and why
 * each listed account that does not was skipped. Pure: the prefs and the app
 * state arrive as parameters and the lines come back, so the command only
 * prints them.
 */

import type { SyncPrefs } from '../accounts/syncPrefs';
import { type SyncWorld, pickSyncAccount, skipReason } from '../state/syncAccount';

/** `@handle` for the account with {@link key}, or the bare key when it is not signed in. */
export function accountLabel(world: SyncWorld, key: string): string {
  const account = world.accounts.find((candidate) => candidate.key === key);
  return account === undefined ? key : `@${account.handle}`;
}

/** The line for the listed account {@link key} at {@link index}, with why it is skipped if it is. */
function listedLine(world: SyncWorld, key: string, index: number): string {
  const role = index === 0 ? 'Primary:' : `Fallback ${String(index)}:`;
  const reason = skipReason(key, world);
  const note = reason === null ? '' : ` (skipped: ${reason})`;
  return `${role} ${accountLabel(world, key)}${note}`;
}

/** The "In use" line: the account that holds the desk, or none. */
function inUseLine(prefs: SyncPrefs, world: SyncWorld): string {
  const key = pickSyncAccount(prefs, world);
  return `In use: ${key === null ? 'none' : accountLabel(world, key)}`;
}

/** The lines `/sync` prints for {@link prefs} over {@link world}. */
export function syncReport(prefs: SyncPrefs, world: SyncWorld): readonly string[] {
  if (!prefs.syncEnabled) {
    return ['Sync: off. Type /sync on to switch it back on'];
  }
  const listed = prefs.syncAccounts.map((key, index) => listedLine(world, key, index));
  const chosen =
    listed.length === 0 ? ['Primary: none chosen (the first usable account is used)'] : listed;
  return ['Sync: on', ...chosen, inUseLine(prefs, world)];
}
