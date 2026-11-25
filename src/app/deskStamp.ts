/**
 * The local stamp of the synced desk (decision 17): the moment, in ms since
 * the epoch, the desk or the settings last changed on this device, or were
 * last taken from the server. It is what the server's `updatedAt` is compared
 * with, so it is kept beside the saved desk, per device class, and survives a
 * reload. Zero means nothing has changed here yet.
 */
import * as v from 'valibot';

import type { DeskSource } from './deskSource';

/** What a stamp is stored as. */
const StampSchema = v.pipe(v.number(), v.minValue(0));

/** The key of {@link source}'s stamp, beside the saved desk of the same class. */
function stampKey(source: DeskSource): string {
  return `stamp:${source.deviceClass}`;
}

/** The stamp of {@link source}'s desk; 0 when none was stored. */
export function readStamp(source: DeskSource): number {
  return source.store.get(stampKey(source), StampSchema) ?? 0;
}

/** Keeps {@link stamp} as the moment {@link source}'s desk last changed. */
export function writeStamp(source: DeskSource, stamp: number): void {
  source.store.set(stampKey(source), stamp);
}
