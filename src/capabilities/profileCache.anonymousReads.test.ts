/**
 * Tests for the signed-out read policy in the session profile cache
 * (decision 5): it survives a round trip, an entry cached before the field
 * existed reads as all null rather than corrupt, and a malformed one is a miss.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type Capabilities, NO_ANONYMOUS_READS } from './capabilities';
import type { InstanceProfile } from './detect';
import { type ProfileStorage, cacheProfile, readCachedProfile } from './profileCache';
import { capabilitiesOn } from './testCapabilities';

const ORIGIN = 'https://wired.example';

/** The profile of {@link ORIGIN} with the given capabilities. */
function profileWith(capabilities: Capabilities): InstanceProfile {
  return { origin: ORIGIN, title: 'The Wired', capabilities };
}

/** A {@link ProfileStorage} over {@link entries} that keeps JSON and validates on read. */
function storeOver(entries: Map<string, string>): ProfileStorage {
  return {
    get: (key, schema) => {
      const raw = entries.get(key);
      const parsed = raw === undefined ? undefined : v.safeParse(schema, JSON.parse(raw));
      return parsed?.success === true ? parsed.output : undefined;
    },
    set: (key, value) => {
      entries.set(key, JSON.stringify(value));
      return true;
    },
    remove: (key) => {
      entries.delete(key);
    },
  };
}

/** Files {@link capabilities} as a raw entry the way an older or odd build would have. */
function rawEntry(capabilities: unknown): Map<string, string> {
  const profile = { origin: ORIGIN, title: 'The Wired', capabilities };
  return new Map([[ORIGIN, JSON.stringify({ detectedAt: 1, profile })]]);
}

describe('profile cache anonymousReads', () => {
  it('round-trips the published anonymous reads', () => {
    const storage = storeOver(new Map());
    const anonymousReads = {
      posts: { local: true, remote: false },
      profiles: { local: null, remote: true },
      tags: { local: false, remote: null },
    };
    const capabilities = { ...capabilitiesOn('wired', ['markdown']), anonymousReads };

    cacheProfile(storage, profileWith(capabilities), 1);

    expect(readCachedProfile(storage, ORIGIN)?.capabilities).toStrictEqual(capabilities);
  });

  it('reads an entry cached before the field existed as all null, not as corrupt', () => {
    const older: Record<string, unknown> = {
      ...capabilitiesOn('wired', []),
      features: ['markdown'],
    };
    delete older['anonymousReads'];

    const read = readCachedProfile(storeOver(rawEntry(older)), ORIGIN);

    expect(read?.capabilities.anonymousReads).toStrictEqual(NO_ANONYMOUS_READS);
    expect(read?.capabilities.features).toStrictEqual(new Set(['markdown']));
  });

  it('misses for an entry whose anonymous reads are malformed', () => {
    const capabilities = {
      ...capabilitiesOn('wired', []),
      features: [],
      anonymousReads: { posts: 'open' },
    };

    expect(readCachedProfile(storeOver(rawEntry(capabilities)), ORIGIN)).toBeUndefined();
  });
});
