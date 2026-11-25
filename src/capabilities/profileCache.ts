/**
 * The session cache of instance detection (decision 5): what an instance
 * turned out to be is computed once per origin and kept for the session, so a
 * reload reads it back instead of asking NodeInfo and the instance documents
 * again. The profile is stored under its origin with the moment it was
 * detected, in a store the app backs with `sessionStorage` (decision 10: only
 * the storage module touches storage; this module takes the store handed to it).
 * Whatever is stored is validated on the way out, so a stale or foreign entry
 * reads as a miss. {@link refreshingDetect} and {@link forgetProfile} are how a
 * `/connect` or a capability that answered 404/501 makes the next read fresh.
 */
import * as v from 'valibot';

import { BACKENDS } from './backend';
import { type Capabilities, FEATURE_FLAGS } from './capabilities';
import type { Detect, InstanceProfile } from './detect';
import { ok } from '../lib/result';

/** The slice of the app's store this module uses, so it never imports storage. */
export type ProfileStorage = {
  readonly get: <T>(key: string, schema: v.GenericSchema<unknown, T>) => T | undefined;
  readonly set: (key: string, value: unknown) => boolean;
  readonly remove: (key: string) => void;
};

/** What is stored for one origin: the profile and when it was detected (epoch ms). */
type CachedProfile = { readonly detectedAt: number; readonly profile: InstanceProfile };

/** {@link PollLimits} as stored. */
const PollLimitsWireSchema = v.object({
  maxOptions: v.number(),
  maxCharactersPerOption: v.number(),
  minExpiration: v.number(),
  maxExpiration: v.number(),
});

/** Capabilities as stored: the feature set is a list of known flags. */
const CapabilitiesWireSchema = v.object({
  backend: v.picklist(BACKENDS),
  maxCharacters: v.number(),
  maxMediaAttachments: v.number(),
  pollLimits: PollLimitsWireSchema,
  features: v.array(v.picklist(FEATURE_FLAGS)),
});

/** An {@link InstanceProfile} as stored. */
const ProfileWireSchema = v.object({
  origin: v.string(),
  title: v.string(),
  capabilities: CapabilitiesWireSchema,
});

/** The stored record, read back into a {@link CachedProfile}. */
const CachedProfileSchema: v.GenericSchema<unknown, CachedProfile> = v.pipe(
  v.object({ detectedAt: v.number(), profile: ProfileWireSchema }),
  v.transform(({ detectedAt, profile }) => ({
    detectedAt,
    profile: {
      ...profile,
      capabilities: { ...profile.capabilities, features: new Set(profile.capabilities.features) },
    },
  })),
);

/** {@link capabilities} in the form that survives JSON. */
function serializable(capabilities: Capabilities): unknown {
  return { ...capabilities, features: [...capabilities.features] };
}

/** The profile cached for {@link origin} this session, or undefined. */
export function readCachedProfile(
  storage: ProfileStorage,
  origin: string,
): InstanceProfile | undefined {
  const cached = storage.get(origin, CachedProfileSchema);
  return cached?.profile.origin === origin ? cached.profile : undefined;
}

/** Keeps {@link profile} for the session, stamped with {@link detectedAt} (epoch ms). */
export function cacheProfile(
  storage: ProfileStorage,
  profile: InstanceProfile,
  detectedAt: number,
): void {
  const stored = { ...profile, capabilities: serializable(profile.capabilities) };
  storage.set(profile.origin, { detectedAt, profile: stored });
}

/** Drops the cached profile of {@link origin}, so the next detection asks the instance again. */
export function forgetProfile(storage: ProfileStorage, origin: string): void {
  storage.remove(origin);
}

/**
 * {@link detect} that asks the instance again and keeps the answer for the
 * session; a failed detection is not cached. {@link now} stamps the entry.
 */
export function refreshingDetect(
  storage: ProfileStorage,
  detect: Detect,
  now: () => number,
): Detect {
  return async (origin) => {
    const detected = await detect(origin);
    if (detected.ok) {
      cacheProfile(storage, detected.value, now());
    }
    return detected;
  };
}

/**
 * {@link detect} that answers from the session cache and only asks the
 * instance when it holds nothing for the origin, keeping what it learns.
 */
export function cachedDetect(storage: ProfileStorage, detect: Detect, now: () => number): Detect {
  const refresh = refreshingDetect(storage, detect, now);
  return async (origin) => {
    const cached = readCachedProfile(storage, origin);
    return cached === undefined ? await refresh(origin) : ok(cached);
  };
}
