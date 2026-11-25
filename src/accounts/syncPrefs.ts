/**
 * Where the synced desk lives (decision 17): which accounts may hold it, in
 * order (first = primary), and whether sync is switched on at all. This is
 * local-only on purpose — it decides where sync goes, so it is never part of
 * what syncs. Stored under its own key of the {@link Store} handed in and
 * validated on every read; anything missing or corrupt reads as the defaults
 * (an empty list, sync on). Nothing is cached in memory.
 */

import * as v from 'valibot';

import type { Store } from '../storage/store';

/** The user's sync choices. */
export type SyncPrefs = {
  /** Ordered account keys, first = primary; empty means "the first usable account". */
  readonly syncAccounts: readonly string[];
  /** False after `/sync off`: nothing is synced anywhere. */
  readonly syncEnabled: boolean;
};

/** The persisted sync choices. */
export type SyncStore = {
  /** What is stored, or the defaults. */
  readonly read: () => SyncPrefs;
  /** Stores {@link prefs}; false when storage is unavailable or full. */
  readonly write: (prefs: SyncPrefs) => boolean;
  /** Takes the account with this key out of the list; nothing else changes. */
  readonly forget: (key: string) => void;
};

/** What reads back when nothing valid is stored. */
const DEFAULT_PREFS: SyncPrefs = { syncAccounts: [], syncEnabled: true };

/** The key of the one value this module owns. */
const PREFS_KEY = 'prefs';

/** The stored value: both fields, the flag defaulting to on. */
const SyncPrefsSchema = v.object({
  syncAccounts: v.array(v.string()),
  syncEnabled: v.optional(v.boolean(), true),
});

/** A {@link SyncStore} over one {@link Store} namespace. */
export function createSyncStore(store: Store): SyncStore {
  const read = (): SyncPrefs => store.get(PREFS_KEY, SyncPrefsSchema) ?? DEFAULT_PREFS;

  const write = (prefs: SyncPrefs): boolean => store.set(PREFS_KEY, prefs);

  const forget = (key: string): void => {
    const prefs = read();
    if (prefs.syncAccounts.includes(key)) {
      write({ ...prefs, syncAccounts: prefs.syncAccounts.filter((listed) => listed !== key) });
    }
  };

  return { read, write, forget };
}
