/**
 * Tests for taking a registered account into the running session: the app
 * state hears of the account (active) and of its sign-in (which is what makes
 * the stream feed or opens its windows, tested in src/state/signIn), the
 * status window says so, and the instance's profile is dispatched —
 * or the failure to read it is printed instead.
 */
import { describe, expect, it, vi } from 'vitest';

import { type AdoptEnv, adoptAccount } from './adoptAccount';
import { type StoredAccount, createAccountStore } from '../../accounts/accountStore';
import { DEFAULT_POLL_LIMITS } from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { err, ok } from '../../lib/result';
import { createStore } from '../../storage/store';
import { memoryBackend } from '../../test/memoryBackend';

const ORIGIN = 'https://wired.example';

/** What a signed-in registration leaves in the account store. */
const NEW: Omit<StoredAccount, 'key'> = {
  origin: ORIGIN,
  accountId: '109',
  handle: 'lain@wired.example',
  token: 'user-token',
  refreshToken: null,
  expiresAt: null,
};

/** The profile the instance reports. */
const PROFILE: InstanceProfile = {
  origin: ORIGIN,
  title: 'Wired',
  capabilities: {
    backend: 'wired',
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(),
  },
};

/** The account store holding the new account, and that account. */
function stored(): {
  readonly accounts: ReturnType<typeof createAccountStore>;
  readonly account: StoredAccount;
} {
  const accounts = createAccountStore(createStore('adopt-test', memoryBackend()));
  return { accounts, account: accounts.add(NEW) };
}

describe(adoptAccount, () => {
  it('activates the account, lets the app state place it, says so and dispatches the profile', async () => {
    const { accounts, account } = stored();
    const dispatch = vi.fn();

    const detect = vi.fn<AdoptEnv['detect']>().mockResolvedValue(ok(PROFILE));

    await adoptAccount(account, { dispatch, accounts, detect });

    expect(dispatch.mock.calls).toMatchObject([
      [{ type: 'accounts', accounts: [account], activeKey: account.key }],
      [{ type: 'signedIn', account, date: expect.any(Date) as unknown }],
      [{ type: 'print', level: 'info', text: `Logged in to ${ORIGIN} as @lain@wired.example` }],
      [{ type: 'profile', profile: PROFILE }],
    ]);
  });

  it('prints why the instance could not be read', async () => {
    const { accounts, account } = stored();
    const dispatch = vi.fn();
    const detect = vi
      .fn<AdoptEnv['detect']>()
      .mockResolvedValue(err({ kind: 'network', message: 'down' }));

    await adoptAccount(account, { dispatch, accounts, detect });

    expect(dispatch.mock.calls.at(-1)).toMatchObject([
      { type: 'print', level: 'error', text: `Could not reach ${ORIGIN}: Network error: down` },
    ]);
  });
});
