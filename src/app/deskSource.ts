/**
 * Where this device's desk is saved (decision 17): the `desk` store of
 * `src/storage`, under the key of the device's class, so a phone and a laptop
 * sharing one origin keep separate layouts. Reading it back is
 * {@link restoreDesk}, which startup calls once accounts are loaded.
 */

import { DEVICE_CLASS } from './readDeviceClass';
import type { StoredAccount } from '../accounts/accountStore';
import type { DeviceClass } from '../lib/deviceClass';
import { DeskSnapshotSchema } from '../state/deskSchema';
import { type DeskState, fromSnapshot } from '../state/deskSnapshot';
import { createStore } from '../storage/store';
import type { Store } from '../storage/store';

/** The store the desk lives in and the key (the device class) it lives under. */
export type DeskSource = {
  readonly store: Store;
  readonly deviceClass: DeviceClass;
};

/** The created source; undefined until someone first asks for it. */
let cached: DeskSource | undefined;

/** This device's desk source, created on the first call and shared from then on. */
export function deskSource(): DeskSource {
  cached ??= { store: createStore('desk'), deviceClass: DEVICE_CLASS };
  return cached;
}

/**
 * The saved desk for the signed-in {@link accounts}, or null when there is no
 * source, nothing saved, or what is saved is corrupt or from another version.
 */
export function restoreDesk(
  source: DeskSource | undefined,
  accounts: readonly StoredAccount[],
): DeskState | null {
  const snapshot = source?.store.get(source.deviceClass, DeskSnapshotSchema);
  return snapshot === undefined ? null : fromSnapshot(snapshot, accounts);
}
