/**
 * Tests for the windows a session boots into: one home window and one
 * notifications window per account, the notifications opened right after its
 * home, the other accounts' pairs first and the active account's last —
 * opening a window is what makes it the visible one. Titles follow each
 * kind's own rule; with no active account every window is titled by username
 * and the given order holds; no accounts open nothing.
 */
import { describe, expect, it } from 'vitest';

import { openStartupWindows } from './startupWindows';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { WindowsAction } from '../windows/reducer';

const ORIGIN = 'https://wired.example';
const OTHER = 'https://b.example';

/** An account on each origin, plus one whose handle carries no host. */
const LAIN: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};
const ALI: StoredAccount = {
  key: accountKey(ORIGIN, '2'),
  origin: ORIGIN,
  accountId: '2',
  handle: 'ali@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};
const SAM: StoredAccount = {
  key: accountKey(OTHER, '3'),
  origin: OTHER,
  accountId: '3',
  handle: 'sam',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The open action for {@link account}'s {@link kind} window, titled {@link title}. */
function openFor(kind: 'home' | 'notifications', account: StoredAccount, title: string) {
  return {
    type: 'open' as const,
    ref: { kind, accountKey: account.key, target: null },
    title,
  };
}

/** The home-then-notifications pair for {@link account}, titled as given. */
function pairFor(account: StoredAccount, homeTitle: string, notifsTitle: string) {
  return [
    openFor('home', account, homeTitle),
    openFor('notifications', account, notifsTitle),
  ] satisfies WindowsAction[];
}

describe(openStartupWindows, () => {
  it('opens home then notifications per account, the active account’s pair last', () => {
    expect(openStartupWindows([LAIN, ALI, SAM], ALI.key)).toStrictEqual([
      ...pairFor(LAIN, 'home/lain', 'notifs/lain'),
      ...pairFor(SAM, 'home/sam', 'notifs/sam'),
      ...pairFor(ALI, 'home', 'notifs'),
    ]);
  });

  it('keeps the order of the accounts it was given while none is active', () => {
    expect(openStartupWindows([LAIN, ALI], null)).toStrictEqual([
      ...pairFor(LAIN, 'home/lain', 'notifs/lain'),
      ...pairFor(ALI, 'home/ali', 'notifs/ali'),
    ]);
  });

  it('opens the one active account’s pair titled plain', () => {
    expect(openStartupWindows([LAIN], LAIN.key)).toStrictEqual(pairFor(LAIN, 'home', 'notifs'));
  });

  it('opens nothing for no accounts', () => {
    expect(openStartupWindows([], LAIN.key)).toStrictEqual([]);
  });
});
