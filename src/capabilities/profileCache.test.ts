/**
 * Tests for the session cache of instance detection (decision 5): a cached
 * profile reads back with its feature set intact; absent, corrupt, unknown
 * and misfiled entries read as misses; a cached detection asks the instance
 * once and a refreshing one every time; a failed detection is never cached.
 */
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';

import { type Capabilities, DEFAULT_POLL_LIMITS, NO_ANONYMOUS_READS } from './capabilities';
import type { Detect, InstanceProfile } from './detect';
import {
  type ProfileStorage,
  cacheProfile,
  cachedDetect,
  forgetProfile,
  readCachedProfile,
  refreshingDetect,
} from './profileCache';
import { err, ok } from '../lib/result';

const ORIGIN = 'https://wired.example';

const OTHER_ORIGIN = 'https://other.example';

/** The key the fake store files {@link ORIGIN}'s entry under. */
const RAW_KEY = `profiles:${ORIGIN}`;

const CAPABILITIES: Capabilities = {
  backend: 'wired',
  maxCharacters: 5000,
  maxMediaAttachments: 6,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set(['quotePosting', 'markdown']),
  anonymousReads: NO_ANONYMOUS_READS,
};

const PROFILE: InstanceProfile = { origin: ORIGIN, title: 'The Wired', capabilities: CAPABILITIES };

/** The raw JSON entries a fake store keeps, which the tests can read and corrupt. */
type Backing = { readonly entries: Map<string, string> };

/** A fresh, empty backing. */
function backing(): Backing {
  return { entries: new Map<string, string>() };
}

/** A {@link ProfileStorage} that keeps JSON in {@link backend} and validates on read, like the app's store. */
function storeOver(backend: Backing): ProfileStorage {
  return {
    get: (key, schema) => {
      const raw = backend.entries.get(`profiles:${key}`);
      const parsed = raw === undefined ? undefined : v.safeParse(schema, JSON.parse(raw));
      return parsed?.success === true ? parsed.output : undefined;
    },
    set: (key, value) => {
      backend.entries.set(`profiles:${key}`, JSON.stringify(value));
      return true;
    },
    remove: (key) => {
      backend.entries.delete(`profiles:${key}`);
    },
  };
}

describe(readCachedProfile, () => {
  it('reads back what cacheProfile kept, feature set included', () => {
    const storage = storeOver(backing());

    cacheProfile(storage, PROFILE, 42);

    expect(readCachedProfile(storage, ORIGIN)).toStrictEqual(PROFILE);
  });

  it('keeps the moment of detection beside the profile', () => {
    const backend = backing();

    cacheProfile(storeOver(backend), PROFILE, 42);

    expect(JSON.parse(backend.entries.get(RAW_KEY) ?? 'null')).toMatchObject({ detectedAt: 42 });
  });

  it('misses for an origin nothing was cached for', () => {
    const storage = storeOver(backing());
    cacheProfile(storage, PROFILE, 1);

    expect(readCachedProfile(storage, OTHER_ORIGIN)).toBeUndefined();
  });

  it('misses for an entry that is not a profile', () => {
    const backend = backing();
    backend.entries.set(RAW_KEY, JSON.stringify({ detectedAt: 1, profile: { origin: ORIGIN } }));

    expect(readCachedProfile(storeOver(backend), ORIGIN)).toBeUndefined();
  });

  it('misses for an entry with a flag or backend this build does not know', () => {
    const backend = backing();
    const stored = (capabilities: Record<string, unknown>): string =>
      JSON.stringify({
        detectedAt: 1,
        profile: { origin: ORIGIN, title: 't', capabilities: { ...CAPABILITIES, ...capabilities } },
      });

    backend.entries.set(RAW_KEY, stored({ features: ['teleportation'] }));

    expect(readCachedProfile(storeOver(backend), ORIGIN)).toBeUndefined();

    backend.entries.set(RAW_KEY, stored({ backend: 'gopher', features: [] }));

    expect(readCachedProfile(storeOver(backend), ORIGIN)).toBeUndefined();
  });

  it('misses for a profile filed under another origin', () => {
    const storage = storeOver(backing());
    const misfiled = {
      ...PROFILE,
      origin: OTHER_ORIGIN,
      capabilities: { ...CAPABILITIES, features: [] },
    };
    storage.set(ORIGIN, { detectedAt: 1, profile: misfiled });

    expect(readCachedProfile(storage, ORIGIN)).toBeUndefined();
  });
});

describe(forgetProfile, () => {
  it('drops only the origin it is given', () => {
    const storage = storeOver(backing());
    cacheProfile(storage, PROFILE, 1);
    cacheProfile(storage, { ...PROFILE, origin: OTHER_ORIGIN }, 1);

    forgetProfile(storage, ORIGIN);

    expect(readCachedProfile(storage, ORIGIN)).toBeUndefined();
    expect(readCachedProfile(storage, OTHER_ORIGIN)?.origin).toBe(OTHER_ORIGIN);
  });
});

describe(cachedDetect, () => {
  it('asks the instance once and answers the second time from the cache', async () => {
    const detect = vi.fn<Detect>().mockResolvedValue(ok(PROFILE));
    const cached = cachedDetect(storeOver(backing()), detect, () => 7);

    const first = await cached(ORIGIN);
    const second = await cached(ORIGIN);

    expect(first).toStrictEqual(ok(PROFILE));
    expect(second).toStrictEqual(ok(PROFILE));
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('answers from what an earlier detector left behind, without asking at all', async () => {
    const storage = storeOver(backing());
    cacheProfile(storage, PROFILE, 1);
    const detect = vi.fn<Detect>();

    const result = await cachedDetect(storage, detect, () => 7)(ORIGIN);

    expect(result).toStrictEqual(ok(PROFILE));
    expect(detect).not.toHaveBeenCalled();
  });

  it('does not cache a failed detection, so the next read asks again', async () => {
    const detect = vi
      .fn<Detect>()
      .mockResolvedValueOnce(err({ kind: 'aborted' }))
      .mockResolvedValueOnce(ok(PROFILE));
    const cached = cachedDetect(storeOver(backing()), detect, () => 7);

    const failed = await cached(ORIGIN);
    const recovered = await cached(ORIGIN);

    expect(failed).toStrictEqual(err({ kind: 'aborted' }));
    expect(recovered).toStrictEqual(ok(PROFILE));
    expect(detect).toHaveBeenCalledTimes(2);
  });

  it('asks again after the profile was forgotten', async () => {
    const storage = storeOver(backing());
    const detect = vi.fn<Detect>().mockResolvedValue(ok(PROFILE));
    const cached = cachedDetect(storage, detect, () => 7);
    await cached(ORIGIN);

    forgetProfile(storage, ORIGIN);
    await cached(ORIGIN);

    expect(detect).toHaveBeenCalledTimes(2);
  });
});

describe(refreshingDetect, () => {
  it('asks the instance every time and keeps the newest answer', async () => {
    const storage = storeOver(backing());
    cacheProfile(storage, PROFILE, 1);
    const fresh = { ...PROFILE, title: 'Renamed' };
    const detect = vi.fn<Detect>().mockResolvedValue(ok(fresh));

    const result = await refreshingDetect(storage, detect, () => 9)(ORIGIN);

    expect(result).toStrictEqual(ok(fresh));
    expect(readCachedProfile(storage, ORIGIN)?.title).toBe('Renamed');
  });

  it('leaves the cache alone when the detection fails', async () => {
    const storage = storeOver(backing());
    cacheProfile(storage, PROFILE, 1);
    const detect = vi.fn<Detect>().mockResolvedValue(err({ kind: 'network', message: 'down' }));

    const result = await refreshingDetect(storage, detect, () => 9)(ORIGIN);

    expect(result).toStrictEqual(err({ kind: 'network', message: 'down' }));
    expect(readCachedProfile(storage, ORIGIN)?.title).toBe('The Wired');
  });
});
