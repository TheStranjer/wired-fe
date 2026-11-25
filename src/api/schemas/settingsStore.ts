/**
 * The envelope of the synced settings (decision 17), as the Pleroma settings
 * store serves it: one JSON object per app, `{ version?: 1, desktop?, mobile? }`
 * with any other key allowed. Only the envelope is checked here; `desktop`
 * and `mobile` stay `unknown` because the sync engine validates the snapshots
 * inside them.
 */
import * as v from 'valibot';

/** The envelope's schema: known keys typed loosely, unknown keys kept as they are. */
export const SettingsStoreSchema = v.pipe(
  v.unknown(),
  v.check((body) => !Array.isArray(body), 'Expected an object, not an array'),
  v.looseObject({
    version: v.optional(v.literal(1)),
    desktop: v.optional(v.unknown()),
    mobile: v.optional(v.unknown()),
  }),
);

/** The stored object: `{}` when nothing was ever saved. */
export type SettingsStore = v.InferOutput<typeof SettingsStoreSchema>;

/**
 * How a collection inside a snapshot must be shaped. The server deep-merges
 * what a PATCH sends into what it stores, so an object keyed by ids would
 * merge instead of replace; an array replaces whole. Every collection of a
 * snapshot (desktops, windows, feeds, floats...) is therefore a
 * {@link SettingsCollection}, never a record keyed by id.
 */
export type SettingsCollection<T> = readonly T[];
