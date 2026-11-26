/**
 * What bare `/sync` prints (decision 17): whether sync is on, the primary and
 * the fallbacks in order, which account holds the synced desk now, and why
 * each listed account that does not was skipped. Pure: the prefs and the app
 * state arrive as parameters and the lines come back, so the command only
 * prints them.
 */

import type { SyncPrefs } from '../accounts/syncPrefs';
import { activeLocale } from '../i18n/activeLocale';
import { formatClock } from '../i18n/format';
import type { AppState } from '../state/appState';
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

/** What `/sync` reads: the accounts and what is known of them, the sync's own status and the clock format. */
type SyncReportWorld = SyncWorld & Pick<AppState, 'sync' | 'settings'>;

/** The lines of what the sync has done so far: when it last pulled and pushed, and the last error; none before it did anything. */
function historyLines(world: SyncReportWorld): readonly string[] {
  const { lastPull, lastPush, lastError } = world.sync;
  const clock = (moment: number): string =>
    formatClock(activeLocale(), new Date(moment), world.settings.clockFormat);
  return [
    ...(lastPull === null ? [] : [`Last pull: ${clock(lastPull)}`]),
    ...(lastPush === null ? [] : [`Last push: ${clock(lastPush)}`]),
    ...(lastError === null ? [] : [`Last error: ${lastError}`]),
  ];
}

/** The lines `/sync` prints for {@link prefs} over {@link world}. */
export function syncReport(prefs: SyncPrefs, world: SyncReportWorld): readonly string[] {
  if (!prefs.syncEnabled) {
    return ['Sync: off. Type /sync on to switch it back on'];
  }
  const listed = prefs.syncAccounts.map((key, index) => listedLine(world, key, index));
  const chosen =
    listed.length === 0 ? ['Primary: none chosen (the first usable account is used)'] : listed;
  return ['Sync: on', ...chosen, inUseLine(prefs, world), ...historyLines(world)];
}
