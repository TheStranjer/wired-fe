/**
 * Tests for the part of the app state a session is made of: the signed-in
 * accounts and where the active pointer may point, what the instances turned out
 * to be, the keyboard's mode and the reader's settings — and that each of them
 * hands back the very same state when the action asked for what already holds.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState, type InputModeState } from './appState';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import type { StoredAccount } from '../accounts/accountStore';
import {
  type Capabilities,
  type FeatureFlag,
  DEFAULT_POLL_LIMITS,
} from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';

const ORIGIN = 'https://wired.example';

const OTHER_ORIGIN = 'https://pleroma.example';

/** The capabilities of an instance these tests name without detecting it. */
const CAPABILITIES: Capabilities = {
  backend: 'wired',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set<FeatureFlag>(['emojiReactions']),
};

/** An account as it is stored, with a token no test reads back. */
function account(handle: string, accountId: string): StoredAccount {
  return {
    key: `${ORIGIN}#${accountId}`,
    origin: ORIGIN,
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

/** The state with {@link accounts} signed in and {@link activeKey} active. */
function signIn(accounts: readonly StoredAccount[], activeKey: string | null): AppState {
  return coreReducer(initialAppState(), { type: 'accounts', accounts, activeKey });
}

/** The action that puts the keyboard in {@link mode}. */
function inMode(state: AppState, mode: InputModeState): AppState {
  return coreReducer(state, { type: 'mode', mode });
}

const lain = account('lain@wired.example', '1');

const alice = account('alice@wired.example', '2');

describe('the account list', () => {
  it('takes the list and the active pointer as they are told', () => {
    const next = signIn([lain, alice], alice.key);

    expect(next.accounts).toStrictEqual([lain, alice]);
    expect(next.activeAccountKey).toBe(alice.key);
  });

  it('leaves no active pointer when the account it named is gone', () => {
    const signedIn = signIn([lain], lain.key);

    const next = coreReducer(signedIn, { type: 'accounts', accounts: [], activeKey: lain.key });

    expect(next.accounts).toStrictEqual([]);
    expect(next.activeAccountKey).toBeNull();
  });

  it('hands back the very same state for the accounts it already has', () => {
    const signedIn = signIn([lain, alice], lain.key);

    expect(
      coreReducer(signedIn, { type: 'accounts', accounts: [lain, alice], activeKey: lain.key }),
    ).toBe(signedIn);
  });

  it('hands back the very same state when a pointer that named nothing is dropped', () => {
    const listed = signIn([lain], 'gone#9');

    const next = coreReducer(listed, { type: 'accounts', accounts: [lain], activeKey: null });

    expect(next).toBe(listed);
    expect(next.activeAccountKey).toBeNull();
  });

  it('keeps the list when the active pointer is dropped', () => {
    const signedIn = signIn([lain], lain.key);

    expect(signedIn.activeAccountKey).toBe(lain.key);

    const next = coreReducer(signedIn, { type: 'accounts', accounts: [lain], activeKey: null });

    expect(next.accounts).toStrictEqual([lain]);
    expect(next.activeAccountKey).toBeNull();
  });

  it('never mutates the state it is given', () => {
    const state = Object.freeze(structuredClone(signIn([lain], lain.key)));
    const before = structuredClone(state);

    coreReducer(state, { type: 'accounts', accounts: [alice], activeKey: 'gone#9' });
    coreReducer(state, { type: 'accounts', accounts: [], activeKey: null });

    expect(state).toStrictEqual(before);
  });
});

describe('an instance profile', () => {
  it('stores what an instance turned out to be under its origin', () => {
    const wired = profileAt(ORIGIN);

    const next = coreReducer(initialAppState(), { type: 'profile', profile: wired });

    expect(next.profiles.get(ORIGIN)).toBe(wired);
    expect(next.profiles.size).toBe(1);
  });

  it('replaces one origin without touching another', () => {
    const withWired = coreReducer(initialAppState(), {
      type: 'profile',
      profile: profileAt(ORIGIN),
    });
    const pleroma = profileAt(OTHER_ORIGIN);

    const stored = coreReducer(withWired, { type: 'profile', profile: pleroma });

    expect([...stored.profiles.keys()]).toStrictEqual([ORIGIN, OTHER_ORIGIN]);

    const redetected = profileAt(OTHER_ORIGIN);
    const again = coreReducer(stored, { type: 'profile', profile: redetected });

    expect(again.profiles.get(OTHER_ORIGIN)).toBe(redetected);
    expect(again.profiles.get(ORIGIN)).toBe(withWired.profiles.get(ORIGIN));
  });

  it('hands back the very same state when told the same profile again', () => {
    const wired = profileAt(ORIGIN);
    const withWired = coreReducer(initialAppState(), { type: 'profile', profile: wired });

    expect(coreReducer(withWired, { type: 'profile', profile: wired })).toBe(withWired);
  });
});

describe('the keyboard mode', () => {
  it('leaves insert mode for navigation, and back again', () => {
    const navigating = inMode(initialAppState(), 'navigation');

    expect(navigating.mode).toBe('navigation');
    expect(inMode(navigating, 'insert').mode).toBe('insert');
  });

  it('hands back the very same state for the mode it is already in', () => {
    const navigating = inMode(initialAppState(), 'navigation');

    expect(inMode(navigating, 'navigation')).toBe(navigating);
  });
});

describe('the settings', () => {
  it('lays a patch over the settings and keeps the knobs it did not name', () => {
    const next = coreReducer(initialAppState(), {
      type: 'settings',
      settings: { clockFormat: '12h', expandMedia: true },
    });

    expect(next.settings).toStrictEqual({
      avatars: true,
      clockFormat: '12h',
      defaultVisibility: 'public',
      density: 'cards',
      effects: false,
      expandMedia: true,
      images: true,
      keyOverrides: [],
      theme: 'wired',
    });
  });

  it('hands back the very same state for a patch that asks for nothing new', () => {
    const state = initialAppState();

    expect(coreReducer(state, { type: 'settings', settings: {} })).toBe(state);
    expect(coreReducer(state, { type: 'settings', settings: { effects: false } })).toBe(state);
  });

  it('changes nothing else about the state', () => {
    const state = signIn([lain], lain.key);
    const loud: Settings = { ...DEFAULT_SETTINGS, effects: true };

    const next = coreReducer(state, { type: 'settings', settings: loud });

    expect(next.settings).toStrictEqual(loud);
    expect(next.accounts).toStrictEqual(state.accounts);
    expect(next.windows).toBe(state.windows);
    expect(next.buffers).toBe(state.buffers);
  });
});
