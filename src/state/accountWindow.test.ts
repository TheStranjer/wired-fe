/**
 * Tests for the rule every window an account owns is named by: the open action
 * carries that kind and account with nothing to target, and the title is the
 * plain kind while it is the active account's own window and
 * `<kind>/<username>` for another account's — the same rule that titles `home`
 * and `home/ali` titles `local` and `federated`, the way /local and /federated
 * open them.
 */
import { describe, expect, it } from 'vitest';

import { accountWindowOpen } from './accountWindow';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { type WindowKind, type WindowRef, initialWindowsState, windowId } from '../windows/model';
import { windowsReducer } from '../windows/reducer';

const ORIGIN = 'https://wired.example';
const OTHER = 'https://b.example';

/** An account on each origin, plus one whose handle carries no host. */
const LAIN: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};
const ALI: StoredAccount = {
  key: accountKey(ORIGIN, '2'),
  origin: ORIGIN,
  accountId: '2',
  handle: 'ali@wired.example',
  token: 'never-logged',
};
const SAM: StoredAccount = {
  key: accountKey(OTHER, '3'),
  origin: OTHER,
  accountId: '3',
  handle: 'sam',
  token: 'never-logged',
};

/** Lain's own local window, the view the last two tests follow through the list. */
const LOCAL: WindowRef = { kind: 'local', accountKey: LAIN.key, target: null };

/** The open action for {@link account}'s window of kind {@link kind}. */
function openFor(kind: WindowKind, account: StoredAccount, title: string) {
  return {
    type: 'open' as const,
    ref: { kind, accountKey: account.key, target: null },
    title,
  };
}

describe(accountWindowOpen, () => {
  it('opens the active account’s own window of a kind, titled with the kind', () => {
    expect(accountWindowOpen('local', LAIN, LAIN.key)).toStrictEqual(
      openFor('local', LAIN, 'local'),
    );
  });

  it('titles another account’s window with the kind and its username', () => {
    expect(accountWindowOpen('federated', ALI, LAIN.key)).toStrictEqual(
      openFor('federated', ALI, 'federated/ali'),
    );
  });

  it('uses the whole handle when it names no host', () => {
    expect(accountWindowOpen('local', SAM, LAIN.key)).toStrictEqual(
      openFor('local', SAM, 'local/sam'),
    );
  });

  it('titles every window by username while nobody is active', () => {
    expect(accountWindowOpen('home', LAIN, null)).toStrictEqual(openFor('home', LAIN, 'home/lain'));
  });

  it('opens each kind as its own window and finds that window again on a second ask', () => {
    const local = accountWindowOpen('local', LAIN, LAIN.key);
    const federated = accountWindowOpen('federated', LAIN, LAIN.key);
    const empty = initialWindowsState();
    const asked = windowsReducer(windowsReducer(windowsReducer(empty, local), federated), local);

    expect(asked.windows.map((win) => win.title)).toStrictEqual(['status', 'local', 'federated']);
    expect(asked.activeId).toBe(windowId(LOCAL));
  });
});
