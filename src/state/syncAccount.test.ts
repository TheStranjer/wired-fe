/**
 * Tests for the sync-account choice: a table over the listed order, expired
 * and signed-out accounts, instances without the settings store, the empty
 * list's default and sync switched off, plus the reasons accounts are skipped.
 */
import { describe, expect, it } from 'vitest';

import { type SyncWorld, pickSyncAccount, skipReason } from './syncAccount';
import type { SyncPrefs } from '../accounts/syncPrefs';
import { MASTODON_CAPABILITIES, WIRED_CAPABILITIES } from '../capabilities/testCapabilities';
import { accountOn } from '../test/backendSessions';

const WIRED_ONE = 'https://one.example';
const WIRED_TWO = 'https://two.example';
const MASTO = 'https://masto.example';
const GONE = 'https://gone.example#9';

const ONE = accountOn(WIRED_ONE, 'a@one.example');
const TWO = accountOn(WIRED_TWO, 'b@two.example');
const MASTODON = accountOn(MASTO, 'c@masto.example');

/** Three signed-in accounts, the instances detected, and {@link expired} keys expired. */
function world(expired: readonly string[] = []): SyncWorld {
  return {
    accounts: [MASTODON, ONE, TWO],
    profiles: new Map([
      [WIRED_ONE, { origin: WIRED_ONE, title: 'One', capabilities: WIRED_CAPABILITIES }],
      [WIRED_TWO, { origin: WIRED_TWO, title: 'Two', capabilities: WIRED_CAPABILITIES }],
      [MASTO, { origin: MASTO, title: 'Masto', capabilities: MASTODON_CAPABILITIES }],
    ]),
    expired: new Set(expired),
  };
}

/** Sync prefs listing {@link keys}, switched on. */
function listing(...keys: readonly string[]): SyncPrefs {
  return { syncAccounts: keys, syncEnabled: true };
}

/** One row of the pick table. */
type PickCase = {
  readonly name: string;
  readonly prefs: SyncPrefs;
  readonly expired: readonly string[];
  readonly expected: string | null;
};

/** What each combination of list, expiry and switch picks. */
const PICK_CASES: readonly PickCase[] = [
  {
    name: 'the first listed account',
    prefs: listing(TWO.key, ONE.key),
    expired: [],
    expected: TWO.key,
  },
  {
    name: 'the next one when the first is expired',
    prefs: listing(TWO.key, ONE.key),
    expired: [TWO.key],
    expected: ONE.key,
  },
  {
    name: 'the next one when the first has no settings store',
    prefs: listing(MASTODON.key, ONE.key),
    expired: [],
    expected: ONE.key,
  },
  {
    name: 'the next one when the first is not signed in',
    prefs: listing(GONE, TWO.key),
    expired: [],
    expected: TWO.key,
  },
  {
    name: 'nothing when every listed account is unusable',
    prefs: listing(MASTODON.key, TWO.key),
    expired: [TWO.key],
    expected: null,
  },
  { name: 'nothing for a list of strangers', prefs: listing(GONE), expired: [], expected: null },
  {
    name: 'the first account with a store when the list is empty',
    prefs: listing(),
    expired: [],
    expected: ONE.key,
  },
  {
    name: 'the next account when the default one is expired',
    prefs: listing(),
    expired: [ONE.key],
    expected: TWO.key,
  },
  {
    name: 'nothing when the list is empty and nobody can',
    prefs: listing(),
    expired: [ONE.key, TWO.key],
    expected: null,
  },
  {
    name: 'nothing when sync is off',
    prefs: { syncAccounts: [TWO.key], syncEnabled: false },
    expired: [],
    expected: null,
  },
  {
    name: 'nothing when sync is off and the list is empty',
    prefs: { syncAccounts: [], syncEnabled: false },
    expired: [],
    expected: null,
  },
];

describe(pickSyncAccount, () => {
  it.each(PICK_CASES)('picks $name', ({ prefs, expired, expected }) => {
    expect(pickSyncAccount(prefs, world(expired))).toBe(expected);
  });

  it('picks nothing without accounts', () => {
    const empty: SyncWorld = { accounts: [], profiles: new Map(), expired: new Set() };

    expect(pickSyncAccount(listing(), empty)).toBeNull();
  });
});

/** One row of the skip table. */
type SkipCase = {
  readonly name: string;
  readonly key: string;
  readonly expired: readonly string[];
  readonly expected: string | null;
};

/** Why each kind of account is or is not usable. */
const SKIP_CASES: readonly SkipCase[] = [
  { name: 'an account that can hold the desk', key: ONE.key, expired: [], expected: null },
  { name: 'an account that is not signed in', key: GONE, expired: [], expected: 'not signed in' },
  { name: 'an expired account', key: ONE.key, expired: [ONE.key], expected: 'session expired' },
  {
    name: 'an instance without the settings store',
    key: MASTODON.key,
    expired: [],
    expected: 'no settings store',
  },
];

describe(skipReason, () => {
  it.each(SKIP_CASES)('says the right thing for $name', ({ key, expired, expected }) => {
    expect(skipReason(key, world(expired))).toBe(expected);
  });

  it('treats an instance that is not detected yet as having no settings store', () => {
    const undetected: SyncWorld = { ...world(), profiles: new Map() };

    expect(skipReason(ONE.key, undetected)).toBe('no settings store');
  });
});
