/**
 * Tests for the `settingsStore` capability (decision 5, decision 17): detection
 * turns it on for Wired, Pleroma and Akkoma and leaves it off for Mastodon, and
 * the session profile cache keeps it, reading an entry cached before the flag
 * existed as lacking it.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  NO_ANONYMOUS_READS,
  type FeatureFlag,
} from './capabilities';
import { detectInstance } from './detect';
import { type ProfileStorage, cacheProfile, readCachedProfile } from './profileCache';
import { NODEINFO_REL_21 } from '../api/nodeinfo';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';

/** The cache key {@link storeOver} files {@link ORIGIN}'s entry under. */
const RAW_KEY = `profiles:${ORIGIN}`;

/** Serves a NodeInfo naming {@link software} and an instance document without limits. */
function serveInstance(software: string): void {
  const links = [{ rel: NODEINFO_REL_21, href: `${ORIGIN}/nodeinfo/2.1` }];
  const nodeInfo = { version: '2.1', software: { name: software }, metadata: {} };
  const instance = { title: 'Lounge', version: '2.7.2' };
  server.use(
    http.get(`${ORIGIN}/.well-known/nodeinfo`, () => HttpResponse.json({ links })),
    http.get(`${ORIGIN}/nodeinfo/2.1`, () => HttpResponse.json(nodeInfo)),
    http.get(`${ORIGIN}/api/v1/instance`, () => HttpResponse.json(instance)),
    http.get(`${ORIGIN}/api/v2/instance`, () => HttpResponse.json(instance)),
  );
}

/** A {@link ProfileStorage} over raw JSON in {@link entries}, validating on read like the app's store. */
function storeOver(entries: Map<string, string>): ProfileStorage {
  return {
    get: (key, schema) => {
      const raw = entries.get(`profiles:${key}`);
      const parsed = raw === undefined ? undefined : v.safeParse(schema, JSON.parse(raw));
      return parsed?.success === true ? parsed.output : undefined;
    },
    set: (key, value) => {
      entries.set(`profiles:${key}`, JSON.stringify(value));
      return true;
    },
    remove: (key) => {
      entries.delete(`profiles:${key}`);
    },
  };
}

/** Capabilities of a Wired instance carrying {@link features} and no limits. */
function capabilitiesWith(features: readonly FeatureFlag[]): Capabilities {
  return {
    backend: 'wired',
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(features),
    anonymousReads: NO_ANONYMOUS_READS,
  };
}

describe('settingsStore detection', () => {
  it.each([
    ['Wired', true],
    ['Pleroma', true],
    ['Akkoma', true],
    ['Mastodon', false],
  ] as const)('on %s is %s', async (software, expected) => {
    serveInstance(software);

    const result = await detectInstance(ORIGIN);

    expect(result.ok && result.value.capabilities.features.has('settingsStore')).toBe(expected);
  });
});

describe('settingsStore in the profile cache', () => {
  it('round-trips the flag', () => {
    const storage = storeOver(new Map());
    const capabilities = capabilitiesWith(['settingsStore']);

    cacheProfile(storage, { origin: ORIGIN, title: 'Lounge', capabilities }, 1);

    expect(readCachedProfile(storage, ORIGIN)?.capabilities.features).toStrictEqual(
      new Set(['settingsStore']),
    );
  });

  it('reads a profile cached before the flag existed as lacking it', () => {
    const entries = new Map<string, string>();
    const capabilities = { ...capabilitiesWith([]), features: ['quotePosting', 'markdown'] };
    const profile = { origin: ORIGIN, title: 'Lounge', capabilities };
    entries.set(RAW_KEY, JSON.stringify({ detectedAt: 1, profile }));

    const read = readCachedProfile(storeOver(entries), ORIGIN);

    expect(read?.capabilities.features.has('settingsStore')).toBe(false);
    expect(read?.capabilities.features.has('quotePosting')).toBe(true);
  });
});
