/**
 * The signed-in desk the `/sync` tests share (AGENTS.md "Testing"): three
 * accounts on three instances — lain and eve on Wired instances that have the
 * settings store, bob on a Mastodon that has not — all detected, in a command
 * context whose state came through the real reducer.
 */
import { vi } from 'vitest';

import { fakeCommandContext } from './commandContext';
import { accountKey } from '../accounts/accountStore';
import type { CommandContext } from '../commands/types';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';

/** The capabilities of a detected instance, as a profile carries them. */
type Detected = Extract<AppAction, { readonly type: 'profile' }>['profile']['capabilities'];

/** The three instances. */
const LAIN = 'https://lain.example';
const BOB = 'https://bob.example';
const EVE = 'https://eve.example';

/** The stored keys of the three accounts, in sign-in order. */
export const K_LAIN = accountKey(LAIN, '1');
export const K_BOB = accountKey(BOB, '2');
export const K_EVE = accountKey(EVE, '3');

/** What an instance with or without the settings store reports. */
function detected(backend: Detected['backend'], settingsStore: boolean): Detected {
  return {
    backend,
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: {
      maxOptions: 4,
      maxCharactersPerOption: 50,
      minExpiration: 300,
      maxExpiration: 2629746,
    },
    features: new Set(settingsStore ? (['settingsStore'] as const) : []),
  };
}

/** Origin, account id, handle and capabilities of each signed-in account. */
const SIGNED_IN = [
  [LAIN, '1', 'lain@lain.example', detected('wired', true)],
  [BOB, '2', 'bob@bob.example', detected('mastodon', false)],
  [EVE, '3', 'eve@eve.example', detected('wired', true)],
] as const;

/** A context signed in to the three accounts, their instances detected, {@link expired} keys expired. */
export function desk(expired: readonly string[] = []): CommandContext {
  const context = fakeCommandContext();
  for (const [origin, accountId, handle] of SIGNED_IN) {
    context.stores.accounts.add({
      origin,
      accountId,
      handle,
      token: 'token',
      refreshToken: null,
      expiresAt: null,
    });
  }
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: context.stores.accounts.list(),
    activeKey: context.stores.accounts.activeKey(),
  });
  for (const [origin, , , capabilities] of SIGNED_IN) {
    state = appReducer(state, {
      type: 'profile',
      profile: { origin, title: origin, capabilities },
    });
  }
  for (const key of expired) {
    state = appReducer(state, { type: 'accountExpired', accountKey: key });
  }
  return { ...context, state, windows: state.windows };
}

/** A desk whose stored list is {@link keys}. */
export function listed(keys: readonly string[], expired: readonly string[] = []): CommandContext {
  const context = desk(expired);
  context.stores.sync.write({ syncAccounts: keys, syncEnabled: true });
  return context;
}

/** What {@link context} printed, one line per call. */
export function printed(context: CommandContext): readonly string[] {
  return vi.mocked(context.print).mock.calls.map(([text]) => text);
}

/** The refusal saying {@link message}. */
export function refused(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

/** What a command says to `@nobody@nowhere.example` when {@link desk}'s three accounts are signed in. */
export const NOT_SIGNED_IN_AS_NOBODY =
  "You aren't signed in as @nobody@nowhere.example. Signed in: @lain@lain.example, @bob@bob.example, @eve@eve.example. Type /connect to add an account.";
