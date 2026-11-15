/**
 * Tests for the home window rules: the open action names the account's own home
 * view, the title is plain `home` while it is the active account's window and
 * `home/<username>` for another account's, and a whole account list turns into
 * one open per account — the others first, the active one last, because opening
 * a window is what makes it the visible one.
 */
import { describe, expect, it } from 'vitest';

import { homeWindowOpen, openHomeWindows } from './homeWindow';
import { accountKey, type StoredAccount } from '../accounts/accountStore';

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

/** The open action for {@link account}, as this file spells the ref out. */
function openFor(account: StoredAccount, title: string) {
  return {
    type: 'open' as const,
    ref: { kind: 'home' as const, accountKey: account.key, target: null },
    title,
  };
}

describe(homeWindowOpen, () => {
  it('opens the active account’s own home window, titled plain', () => {
    expect(homeWindowOpen(LAIN, LAIN.key)).toStrictEqual(openFor(LAIN, 'home'));
  });

  it('titles another account’s home window by its username', () => {
    expect(homeWindowOpen(ALI, LAIN.key)).toStrictEqual(openFor(ALI, 'home/ali'));
  });

  it('uses the whole handle when it names no host', () => {
    expect(homeWindowOpen(SAM, LAIN.key)).toStrictEqual(openFor(SAM, 'home/sam'));
  });

  it('titles every window by username while nobody is active', () => {
    expect(homeWindowOpen(LAIN, null)).toStrictEqual(openFor(LAIN, 'home/lain'));
  });
});

describe(openHomeWindows, () => {
  it('opens one window per account, the active account’s last', () => {
    expect(openHomeWindows([LAIN, ALI, SAM], ALI.key)).toStrictEqual([
      openFor(LAIN, 'home/lain'),
      openFor(SAM, 'home/sam'),
      openFor(ALI, 'home'),
    ]);
  });

  it('keeps the order of the accounts it was given while none is active', () => {
    expect(openHomeWindows([LAIN, ALI], null)).toStrictEqual([
      openFor(LAIN, 'home/lain'),
      openFor(ALI, 'home/ali'),
    ]);
  });

  it('opens nothing for no accounts', () => {
    expect(openHomeWindows([], LAIN.key)).toStrictEqual([]);
  });
});
