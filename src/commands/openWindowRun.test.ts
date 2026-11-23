/**
 * Tests for accountWindowRun: no account is the not-logged-in refusal and no
 * dispatch; an account gets exactly one dispatch of the transition the opener
 * built from that account and the active key.
 */
import { describe, expect, it, vi } from 'vitest';

import { accountWindowRun } from './openWindowRun';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { coreReducer, initialAppState } from '../state/appState';
import { fakeCommandContext } from '../test/commandContext';
import type { WindowsAction } from '../windows/reducer';

const ORIGIN = 'https://wired.example';

/** The one account the signed-in session has. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** What the opener under test answers with. */
const ACTION: WindowsAction = {
  type: 'open',
  ref: { kind: 'home', accountKey: ACCOUNT.key, target: null },
  title: 'home',
};

describe(accountWindowRun, () => {
  it('refuses without an account and dispatches nothing', async () => {
    const open = vi.fn(() => ACTION);
    const dispatchWindows = vi.fn();
    const context = fakeCommandContext({ state: initialAppState(), dispatchWindows });

    const outcome = await accountWindowRun(open)('', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(open).not.toHaveBeenCalled();
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('dispatches the opener’s transition once for the active account', async () => {
    const open = vi.fn(() => ACTION);
    const dispatchWindows = vi.fn();
    const state = coreReducer(initialAppState(), {
      type: 'accounts',
      accounts: [ACCOUNT],
      activeKey: ACCOUNT.key,
    });
    const context = fakeCommandContext({ state, dispatchWindows });

    const outcome = await accountWindowRun(open)('ignored', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(open).toHaveBeenCalledWith(ACCOUNT, ACCOUNT.key);
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith(ACTION);
  });
});
