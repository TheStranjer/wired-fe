/**
 * Startup opening a home window and a notifications window for every restored
 * account: the asks come after the accounts are in the state, each account's
 * notifications right after its home, every window titled the way its command
 * titles it — plain `home` and `notifs` for the active account,
 * `home/<username>` and `notifs/<username>` for the others — and the active
 * account's pair opened last, because opening a window is what makes it the one
 * the reader is looking at. A build with no accounts opens nothing, and none of
 * this prints a line.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { BANNER } from './banner';
import { type Detect, type StartupDeps, runStartup } from './startup';
import type { AppStores } from './stores';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import { ok } from '../lib/result';
import type { AppAction } from '../state/reducer';
import type { Dispatch } from '../state/StateContext';
import { createStore } from '../storage/store';
import { initialWindowsState, windowId } from '../windows/model';
import type { WindowRef, WindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';
import type { WindowsAction } from '../windows/reducer';

const ORIGIN_A = 'https://a.example';
const ORIGIN_B = 'https://b.example';

/** One account per origin. */
const ACCOUNT_A: StoredAccount = {
  key: accountKey(ORIGIN_A, '1'),
  origin: ORIGIN_A,
  accountId: '1',
  handle: 'lain@a.example',
  token: 'token-a',
  refreshToken: null,
  expiresAt: null,
};
const ACCOUNT_B: StoredAccount = {
  key: accountKey(ORIGIN_B, '2'),
  origin: ORIGIN_B,
  accountId: '2',
  handle: 'sam@b.example',
  token: 'token-b',
  refreshToken: null,
  expiresAt: null,
};

/** The home view of {@link account}, as the window list names it. */
function homeOf(account: StoredAccount): WindowRef {
  return { kind: 'home', accountKey: account.key, target: null };
}

/** The notifications view of {@link account}, as the window list names it. */
function notifsOf(account: StoredAccount): WindowRef {
  return { kind: 'notifications', accountKey: account.key, target: null };
}

/** The home-then-notifications pair {@link account} is opened with, titled as given. */
function pairOf(account: StoredAccount, homeTitle: string, notifsTitle: string) {
  return [
    { type: 'open' as const, ref: homeOf(account), title: homeTitle },
    { type: 'open' as const, ref: notifsOf(account), title: notifsTitle },
  ];
}

/** The Wired lounge at {@link origin}. */
function lounge(origin: string): InstanceProfile {
  return {
    origin,
    title: `${origin} Lounge`,
    capabilities: {
      backend: 'wired',
      maxCharacters: 500,
      maxMediaAttachments: 4,
      pollLimits: DEFAULT_POLL_LIMITS,
      features: new Set(),
    },
  };
}

/** The four stores; the accounts one answers {@link accounts} and {@link activeKey}. */
function fakeStores(accounts: readonly StoredAccount[], activeKey: string | null): AppStores {
  const inert = createStore('startup-home-test', null);
  return {
    apps: inert,
    login: inert,
    settings: inert,
    accounts: {
      list: () => accounts,
      get: (key) => accounts.find((account) => account.key === key),
      add: (input) => ({ ...input, key: accountKey(input.origin, input.accountId) }),
      updateTokens: () => undefined,
      remove: () => undefined,
      activeKey: () => activeKey,
      setActive: () => undefined,
    },
  };
}

/** One startup over {@link accounts} and {@link activeKey}; detection always answers. */
async function start(
  accounts: readonly StoredAccount[],
  activeKey: string | null,
): Promise<Mock<Dispatch>> {
  const dispatch = vi.fn<Dispatch>();
  const detect = vi.fn<Detect>(async (origin: string) => await Promise.resolve(ok(lounge(origin))));
  const deps: StartupDeps = {
    dispatch,
    stores: fakeStores(accounts, activeKey),
    config: { appName: 'WIRED', instances: { mode: 'same-origin' } },
    now: () => new Date('2026-11-15T09:00:00.000Z'),
    location: { search: '', pathname: '/', hash: '', replaceUrl: () => undefined },
    detect,
  };

  await runStartup(deps);

  return dispatch;
}

/** Every action the recording {@link dispatch} was asked for, in order. */
function actionsOf(dispatch: Mock<Dispatch>): readonly AppAction[] {
  return dispatch.mock.calls.map(([action]) => action);
}

/** The window-list asks startup made, in order. */
function windowAsks(dispatch: Mock<Dispatch>): readonly WindowsAction[] {
  return actionsOf(dispatch).flatMap((action) =>
    action.type === 'windows' ? [action.action] : [],
  );
}

/** The window list after every ask in {@link asks} is applied to it. */
function windowsAfter(asks: readonly WindowsAction[]): WindowsState {
  return asks.reduce(windowsReducer, initialWindowsState());
}

describe('startup opening account windows', () => {
  it('opens each account’s home and notifications pair, the active account’s last', async () => {
    const asks = windowAsks(await start([ACCOUNT_A, ACCOUNT_B], ACCOUNT_A.key));

    expect(asks).toStrictEqual([
      ...pairOf(ACCOUNT_B, 'home/sam', 'notifs/sam'),
      ...pairOf(ACCOUNT_A, 'home', 'notifs'),
    ]);
  });

  it('lands the reader on the active account’s notifications window', async () => {
    const windows = windowsAfter(windowAsks(await start([ACCOUNT_A, ACCOUNT_B], ACCOUNT_A.key)));

    expect(windows.activeId).toBe(windowId(notifsOf(ACCOUNT_A)));
    expect(windows.windows.map((win) => win.title)).toStrictEqual([
      'status',
      'home/sam',
      'notifs/sam',
      'home',
      'notifs',
    ]);
  });

  it('opens one plain pair for the only account', async () => {
    expect(windowAsks(await start([ACCOUNT_A], ACCOUNT_A.key))).toStrictEqual(
      pairOf(ACCOUNT_A, 'home', 'notifs'),
    );
  });

  it('titles every window by username while no account is active', async () => {
    const asks = windowAsks(await start([ACCOUNT_A, ACCOUNT_B], null));

    expect(asks).toStrictEqual([
      ...pairOf(ACCOUNT_A, 'home/lain', 'notifs/lain'),
      ...pairOf(ACCOUNT_B, 'home/sam', 'notifs/sam'),
    ]);
  });

  it('opens no window on a build with no accounts', async () => {
    expect(windowAsks(await start([], null))).toStrictEqual([]);
  });

  it('restores the accounts before it opens their windows', async () => {
    const types = actionsOf(await start([ACCOUNT_A], ACCOUNT_A.key)).map((action) => action.type);

    expect(types.indexOf('accounts')).toBeLessThan(types.indexOf('windows'));
  });

  it('opens the windows without printing a line of its own', async () => {
    const texts = actionsOf(await start([ACCOUNT_A, ACCOUNT_B], ACCOUNT_B.key))
      .filter((action) => action.type === 'print')
      .map((action) => action.text);

    expect(texts).toStrictEqual([
      ...BANNER,
      'WIRED // WIRED',
      'Present day. Present time.',
      `Connected to ${ORIGIN_A} Lounge (wired) at ${ORIGIN_A}`,
      `Connected to ${ORIGIN_B} Lounge (wired) at ${ORIGIN_B}`,
      'Logged in as @lain@a.example',
      'Logged in as @sam@b.example (active)',
    ]);
  });
});
