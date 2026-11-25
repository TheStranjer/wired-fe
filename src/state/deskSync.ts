/**
 * The synced desk (decision 17), as pure functions: the snapshot that goes to
 * the server is the desk snapshot of ./deskSnapshot plus the whole
 * {@link Settings} (feeds and key overrides included), each stamped with its
 * `updatedAt`. {@link decideSync} is the newest-wins rule over what the
 * server holds and the local stamp; {@link syncPatch} shapes the PATCH body so
 * the server's deep merge replaces the device class's snapshot whole (every
 * collection inside is an array). Nothing here logs or touches the network.
 */
import * as v from 'valibot';

import { DeskSnapshotSchema } from './deskSchema';
import { type DeskState, fromSnapshot, toSnapshot } from './deskSnapshot';
import { SettingsSchema } from './settings';
import type { Settings } from './settings';
import type { StoredAccount } from '../accounts/accountStore';
import type { DeviceClass } from '../lib/deviceClass';
import { stableJson } from '../lib/stableJson';

/** The desk and the settings: what a synced snapshot is made from. */
type SyncState = DeskState & { readonly settings: Settings };

/** A synced snapshot as the server holds it: the desk snapshot plus the settings. */
const SyncSnapshotSchema = v.object({
  ...DeskSnapshotSchema.entries,
  settings: SettingsSchema,
});

/** A synced snapshot, parsed. */
export type SyncSnapshot = v.InferOutput<typeof SyncSnapshotSchema>;

/** What to do after reading the server's copy against the local one. */
export type SyncDecision =
  | { readonly kind: 'apply'; readonly snapshot: SyncSnapshot }
  | { readonly kind: 'push' }
  | { readonly kind: 'keep' }
  | { readonly kind: 'invalid' };

/** The snapshot of {@link state} taken at {@link now} (ms since the epoch). */
export function toSyncSnapshot(state: SyncState, now: number): SyncSnapshot {
  return { ...toSnapshot(state, now), settings: state.settings };
}

/** The desk and settings a snapshot restores to, given who is signed in. */
export function fromSyncSnapshot(
  snapshot: SyncSnapshot,
  accounts: readonly StoredAccount[],
): SyncState {
  return { ...fromSnapshot(snapshot, accounts), settings: snapshot.settings };
}

/** The text that says what {@link state} holds, whatever stamp it carries: equal texts mean nothing changed. */
export function deskBody(state: SyncState): string {
  return stableJson(toSyncSnapshot(state, 0));
}

/**
 * Newest wins. A server copy that is missing, or older than the local stamp,
 * is to be replaced by a push; one that does not parse is ignored; one newer
 * than the local stamp is applied; one stamped the same is already in sync.
 */
export function decideSync(localStamp: number, remote: unknown): SyncDecision {
  if (remote === undefined) {
    return { kind: 'push' };
  }
  const parsed = v.safeParse(SyncSnapshotSchema, remote);
  if (!parsed.success) {
    return { kind: 'invalid' };
  }
  const { updatedAt } = parsed.output;
  if (updatedAt > localStamp) {
    return { kind: 'apply', snapshot: parsed.output };
  }
  return updatedAt < localStamp ? { kind: 'push' } : { kind: 'keep' };
}

/** The PATCH body that replaces {@link deviceClass}'s snapshot and leaves the other class's alone. */
export function syncPatch(
  deviceClass: DeviceClass,
  snapshot: SyncSnapshot,
): Readonly<Record<string, unknown>> {
  return { [deviceClass]: snapshot };
}
