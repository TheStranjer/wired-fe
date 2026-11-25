/**
 * Tests for the reducer's session side: the active account pointer a new list
 * still answers to, when two account lists count as the same, and how a profile
 * or a settings patch is laid over what the state already held.
 */

import { describe, expect, it } from 'vitest';

import { knownActiveKey, mergedSettings, putProfile, sameAccounts } from './appReducer';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import type { StoredAccount } from '../accounts/accountStore';
import { type Capabilities, DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import type { KeyOverride } from '../lib/keyOverride';

const WIRED = 'https://wired.example';

const PLEROMA = 'https://pleroma.example';

/** The capabilities of an instance these tests name without detecting it. */
const CAPABILITIES: Capabilities = {
  backend: 'wired',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set(),
};

/** An account as stored, keyed by origin plus account id. */
function account(accountId: string): StoredAccount {
  const handle = `lain#${accountId}`;
  return {
    key: `${WIRED}#${accountId}`,
    origin: WIRED,
    accountId,
    handle,
    token: 'token',
    refreshToken: null,
    expiresAt: null,
  };
}

/** What the instance at {@link origin} turned out to be. */
function profileAt(origin: string): InstanceProfile {
  return { origin, title: new URL(origin).hostname, capabilities: CAPABILITIES };
}

const lain = account('1');

const alice = account('2');

describe(knownActiveKey, () => {
  it('keeps a key the list holds', () => {
    expect(knownActiveKey([lain, alice], alice.key)).toBe(alice.key);
  });

  it('drops a key the list no longer holds', () => {
    expect(knownActiveKey([lain, alice], `${WIRED}#gone`)).toBeNull();
    expect(knownActiveKey([], lain.key)).toBeNull();
  });

  it('leaves nobody signed in as nobody', () => {
    expect(knownActiveKey([lain], null)).toBeNull();
  });
});

describe(sameAccounts, () => {
  it('sees the same records in the same order as the same list', () => {
    expect(sameAccounts([lain, alice], [lain, alice])).toBe(true);
    expect(sameAccounts([], [])).toBe(true);
  });

  it('sees a changed record as a different list', () => {
    expect(sameAccounts([lain], [{ ...lain, token: 'rotated' }])).toBe(false);
  });

  it('sees a longer list and a reordered one as different', () => {
    expect(sameAccounts([lain], [lain, alice])).toBe(false);
    expect(sameAccounts([lain, alice], [alice, lain])).toBe(false);
  });
});

describe(putProfile, () => {
  const wired = profileAt(WIRED);

  it('stores a profile under its origin, leaving the rest alone', () => {
    const next = putProfile(new Map([[PLEROMA, profileAt(PLEROMA)]]), wired);

    expect(next.get(WIRED)).toBe(wired);
    expect(next.size).toBe(2);
  });

  it('replaces an origin it was told about again', () => {
    const redetected = profileAt(WIRED);

    const next = putProfile(new Map([[WIRED, wired]]), redetected);

    expect(next.get(WIRED)).toBe(redetected);
    expect(next.get(WIRED)).not.toBe(wired);
  });

  it('hands back the very same map for the profile it already holds', () => {
    const profiles = new Map([[WIRED, wired]]);

    expect(putProfile(profiles, wired)).toBe(profiles);
  });
});

describe(mergedSettings, () => {
  it('lays a patch over the settings it is given', () => {
    const patch: Partial<Settings> = { clockFormat: '12h', effects: true };

    expect(mergedSettings(DEFAULT_SETTINGS, patch)).toStrictEqual({
      avatars: true,
      clockFormat: '12h',
      defaultVisibility: 'public',
      density: 'cards',
      effects: true,
      expandMedia: false,
      feeds: [],
      images: true,
      keyOverrides: [],
      openIn: 'here',
      openInByKind: {},
      replyIn: 'split',
      streamMade: false,
      theme: 'wired',
    });
  });

  it('takes a new default placement and new per-kind placements, which are behaviour', () => {
    expect(mergedSettings(DEFAULT_SETTINGS, { openIn: 'float' }).openIn).toBe('float');
    expect(mergedSettings(DEFAULT_SETTINGS, { openIn: 'here' })).toBe(DEFAULT_SETTINGS);
    expect(
      mergedSettings(DEFAULT_SETTINGS, { openInByKind: { thread: 'vsplit' } }).openInByKind,
    ).toStrictEqual({ thread: 'vsplit' });
  });

  it('hands back the very same record for a patch that asks for nothing new', () => {
    expect(mergedSettings(DEFAULT_SETTINGS, {})).toBe(DEFAULT_SETTINGS);
    expect(mergedSettings(DEFAULT_SETTINGS, { expandMedia: false })).toBe(DEFAULT_SETTINGS);
    expect(mergedSettings(DEFAULT_SETTINGS, { theme: 'wired' })).toBe(DEFAULT_SETTINGS);
    expect(mergedSettings(DEFAULT_SETTINGS, { keyOverrides: [] })).not.toBe(DEFAULT_SETTINGS);
    expect(mergedSettings(DEFAULT_SETTINGS, { keyOverrides: DEFAULT_SETTINGS.keyOverrides })).toBe(
      DEFAULT_SETTINGS,
    );
  });

  it.each<Partial<Settings>>([{ avatars: true }, { density: 'cards' }, { images: true }])(
    'hands back the very same record when %o asks for what is already set',
    (patch) => {
      expect(mergedSettings(DEFAULT_SETTINGS, patch)).toBe(DEFAULT_SETTINGS);
    },
  );

  it.each<Partial<Settings>>([{ avatars: false }, { density: 'lines' }, { images: false }])(
    'hands back a new record when %o turns a knob',
    (patch) => {
      expect(mergedSettings(DEFAULT_SETTINGS, patch)).not.toBe(DEFAULT_SETTINGS);
    },
  );

  it('takes a fresh list of key overrides', () => {
    const keyOverrides: readonly KeyOverride[] = [
      { mode: 'navigation', chord: 'Ctrl+e', line: '/fav' },
    ];

    expect(mergedSettings(DEFAULT_SETTINGS, { keyOverrides }).keyOverrides).toStrictEqual(
      keyOverrides,
    );
  });

  it('takes a fresh list of saved feeds, and keeps the very same record for the same list', () => {
    const feeds = [{ id: 'f1', name: 'main', sources: [] }];

    expect(mergedSettings(DEFAULT_SETTINGS, { feeds }).feeds).toStrictEqual(feeds);
    expect(mergedSettings(DEFAULT_SETTINGS, { feeds: DEFAULT_SETTINGS.feeds })).toBe(
      DEFAULT_SETTINGS,
    );
  });

  it('takes a new theme, turning no other knob', () => {
    expect(mergedSettings(DEFAULT_SETTINGS, { theme: 'lain' })).toStrictEqual({
      ...DEFAULT_SETTINGS,
      theme: 'lain',
    });
  });
});
