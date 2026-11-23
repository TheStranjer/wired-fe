/**
 * Tests for the read-only views over the app state: every selector asked for
 * data that is present and for data that is missing — the signed-in accounts
 * and their sessions and instance profiles, the windows' buffers, and the
 * account each window acts as.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import { EMPTY_BUFFER } from './buffer';
import {
  accountByKey,
  activeAccount,
  activeBuffer,
  bufferFor,
  capabilitiesFor,
  sessionFor,
  windowAccountKey,
} from './selectors';
import type { StoredAccount } from '../accounts/accountStore';
import {
  type Capabilities,
  type FeatureFlag,
  DEFAULT_POLL_LIMITS,
} from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import { STATUS_WINDOW_ID, type WindowRef, windowId } from '../windows/model';

const ORIGIN = 'https://wired.example';

const OTHER_ORIGIN = 'https://pleroma.example';

const DATE = new Date('2026-11-12T21:14:05.000Z');

/** The capabilities of an instance these tests name without detecting it. */
const CAPABILITIES: Capabilities = {
  backend: 'wired',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set<FeatureFlag>(['emojiReactions']),
};

/** An account as it is stored, with a token no selector is asked to hide. */
function account(handle: string, origin: string, accountId: string): StoredAccount {
  return {
    key: `${origin}#${accountId}`,
    origin,
    accountId,
    handle,
    token: `token-${accountId}`,
    refreshToken: null,
    expiresAt: null,
  };
}

/** What the instance at {@link origin} turned out to be. */
function profileAt(origin: string): InstanceProfile {
  return { origin, title: new URL(origin).hostname, capabilities: CAPABILITIES };
}

/** Lain and alice signed in, lain active, and their instance detected. */
function signedIn(): AppState {
  const withProfile = coreReducer(initialAppState(), {
    type: 'profile',
    profile: profileAt(ORIGIN),
  });
  return coreReducer(withProfile, {
    type: 'accounts',
    accounts: [lain, alice],
    activeKey: lain.key,
  });
}

/** The state with {@link ref}'s window opened, which makes it the active one. */
function opened(state: AppState, ref: WindowRef): AppState {
  return coreReducer(state, { type: 'windows', action: { type: 'open', ref, title: 'home' } });
}

/** The state with one client message printed into window {@link id}. */
function printed(state: AppState, id: string): AppState {
  return coreReducer(state, {
    type: 'print',
    windowId: id,
    date: DATE,
    level: 'info',
    text: 'hi',
  });
}

const lain = account('lain@wired.example', ORIGIN, '1');

const alice = account('alice@wired.example', ORIGIN, '2');

const onPleroma = account('nine@pleroma.example', OTHER_ORIGIN, '9');

const ALICE_HOME: WindowRef = { kind: 'home', accountKey: alice.key, target: null };

const aliceHomeId = windowId(ALICE_HOME);

describe(accountByKey, () => {
  it('finds the stored account by its key', () => {
    expect(accountByKey(signedIn(), lain.key)).toBe(lain);
    expect(accountByKey(signedIn(), alice.key)).toBe(alice);
  });

  it('reads no account for a key that names none', () => {
    expect(accountByKey(signedIn(), `${ORIGIN}#404`)).toBeNull();
    expect(accountByKey(initialAppState(), lain.key)).toBeNull();
  });

  it('reads no account for a null key', () => {
    expect(accountByKey(signedIn(), null)).toBeNull();
  });
});

describe(activeAccount, () => {
  it('is the account the active pointer names', () => {
    expect(activeAccount(signedIn())).toBe(lain);
  });

  it('is nothing while nobody is signed in', () => {
    expect(activeAccount(initialAppState())).toBeNull();
  });
});

describe(sessionFor, () => {
  it('is the origin and token of that account', () => {
    expect(sessionFor(signedIn(), alice.key)).toStrictEqual({
      origin: ORIGIN,
      token: 'token-2',
    });
  });

  it('is nothing for a missing account or a null key', () => {
    expect(sessionFor(signedIn(), `${ORIGIN}#404`)).toBeNull();
    expect(sessionFor(signedIn(), null)).toBeNull();
  });
});

describe(capabilitiesFor, () => {
  it('is what the instance of that account turned out to be', () => {
    expect(capabilitiesFor(signedIn(), lain.key)).toBe(CAPABILITIES);
  });

  it('is nothing while that origin has no profile', () => {
    const state = coreReducer(initialAppState(), {
      type: 'accounts',
      accounts: [onPleroma],
      activeKey: onPleroma.key,
    });

    expect(capabilitiesFor(state, onPleroma.key)).toBeNull();
  });

  it('is nothing for a missing account or a null key', () => {
    expect(capabilitiesFor(signedIn(), `${ORIGIN}#404`)).toBeNull();
    expect(capabilitiesFor(signedIn(), null)).toBeNull();
  });
});

describe(bufferFor, () => {
  it('is the buffer the window holds', () => {
    const state = printed(opened(signedIn(), ALICE_HOME), aliceHomeId);

    const buffer = bufferFor(state, aliceHomeId);

    expect(buffer).toBe(state.buffers.get(aliceHomeId));
    expect(buffer.lines).toHaveLength(1);
  });

  it('is the empty buffer of an open window that has shown nothing', () => {
    expect(bufferFor(signedIn(), STATUS_WINDOW_ID)).toBe(EMPTY_BUFFER);
  });

  it('is the empty buffer for a window id that is not open', () => {
    expect(bufferFor(signedIn(), 'home:-:-')).toBe(EMPTY_BUFFER);
    expect(bufferFor(initialAppState(), aliceHomeId)).toBe(EMPTY_BUFFER);
  });
});

describe(activeBuffer, () => {
  it('is the buffer of the active window', () => {
    const state = printed(opened(signedIn(), ALICE_HOME), aliceHomeId);

    expect(activeBuffer(state)).toBe(bufferFor(state, aliceHomeId));
  });

  it('is the empty status buffer at the start', () => {
    expect(activeBuffer(initialAppState())).toBe(EMPTY_BUFFER);
  });

  it('follows the pointer from window to window', () => {
    const shown = printed(opened(signedIn(), ALICE_HOME), aliceHomeId);
    const back = coreReducer(shown, {
      type: 'windows',
      action: { type: 'activate', id: STATUS_WINDOW_ID },
    });

    expect(activeBuffer(back)).toBe(EMPTY_BUFFER);
  });
});

describe(windowAccountKey, () => {
  it('is the account the window names in its ref', () => {
    expect(windowAccountKey(opened(signedIn(), ALICE_HOME), aliceHomeId)).toBe(alice.key);
  });

  it('is the active account for the status window', () => {
    expect(windowAccountKey(signedIn(), STATUS_WINDOW_ID)).toBe(lain.key);
  });

  it('is nothing for the status window while nobody is signed in', () => {
    expect(windowAccountKey(initialAppState(), STATUS_WINDOW_ID)).toBeNull();
  });

  it('is nothing for a window id that is not open', () => {
    expect(windowAccountKey(signedIn(), aliceHomeId)).toBeNull();
  });
});
