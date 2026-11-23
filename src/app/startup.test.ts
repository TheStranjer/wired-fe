/**
 * Tests for startup's opening and its report of who is signed in: the
 * decorative banner and its text alternative, the `/connect` hint of a build
 * with no accounts in every instance mode (decision 3), and one line per
 * account — the active one marked — under the reports of the instances they
 * live on.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { BANNER } from './banner';
import { type Detect, type StartupDeps, runStartup } from './startup';
import type { AppStores } from './stores';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import type { InstancesConfig, WiredConfig } from '../config/schema';
import { ok } from '../lib/result';
import type { AppAction } from '../state/reducer';
import type { Dispatch } from '../state/StateContext';
import { createStore } from '../storage/store';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The moment every printed line is stamped with. */
const NOW = new Date('2026-11-15T09:00:00.000Z');

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

/** The banner art, its text alternative and the tagline: every run's opening. */
const GREETING: readonly string[] = [...BANNER, 'WIRED // WIRED', 'Present day. Present time.'];

/** The `print` member of {@link AppAction}, the shape of every startup line. */
type PrintAction = Extract<AppAction, { readonly type: 'print' }>;

/** The lounge each origin answers with. */
const TITLES: ReadonlyMap<string, string> = new Map([
  [ORIGIN_A, 'A Lounge'],
  [ORIGIN_B, 'B Lounge'],
]);

/** The Wired lounge of {@link origin}, titled from {@link TITLES}. */
function lounge(origin: string): InstanceProfile {
  return {
    origin,
    title: TITLES.get(origin) ?? origin,
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
  const inert = createStore('startup-test', null);
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

/** One startup against fake stores; {@link options.detect} omitted means the real one. */
async function start(options: {
  readonly accounts?: readonly StoredAccount[];
  readonly activeKey?: string | null;
  readonly instances?: InstancesConfig;
  readonly detect?: Detect;
}): Promise<Mock<Dispatch>> {
  const dispatch = vi.fn<Dispatch>();
  const instances: InstancesConfig = options.instances ?? { mode: 'same-origin' };
  const config: WiredConfig = { appName: 'WIRED', instances };
  const base = {
    dispatch,
    stores: fakeStores(options.accounts ?? [], options.activeKey ?? null),
    config,
    now: () => NOW,
    location: { search: '', pathname: '/', hash: '', replaceUrl: () => undefined },
  };
  const deps: StartupDeps =
    options.detect === undefined ? base : { ...base, detect: options.detect };

  await runStartup(deps);
  return dispatch;
}

/** Every action the recording {@link dispatch} was asked for, in order. */
function actionsOf(dispatch: Mock<Dispatch>): readonly AppAction[] {
  return dispatch.mock.calls.map(([action]) => action);
}

/** The texts of the printed actions, in order. */
function printedTexts(dispatch: Mock<Dispatch>): readonly string[] {
  return actionsOf(dispatch).flatMap((action) => (action.type === 'print' ? [action.text] : []));
}

/** The print actions, in order. */
function printedActions(dispatch: Mock<Dispatch>): readonly PrintAction[] {
  return actionsOf(dispatch).filter((action): action is PrintAction => action.type === 'print');
}

describe(runStartup, () => {
  it('greets and hints at /connect on a same-origin build with no accounts', async () => {
    const detect = vi.fn<Detect>();
    const dispatch = await start({ detect });

    expect(printedTexts(dispatch)).toStrictEqual([
      ...GREETING,
      'Not connected. Type /connect to log in.',
    ]);
    expect(actionsOf(dispatch)).toContainEqual({ type: 'accounts', accounts: [], activeKey: null });
    expect(detect).not.toHaveBeenCalled();
  });

  it('hints the same way on a fixed build', async () => {
    const dispatch = await start({ instances: { mode: 'fixed', origin: ORIGIN_A } });

    expect(printedTexts(dispatch)[GREETING.length]).toBe('Not connected. Type /connect to log in.');
  });

  it('lists the available origins on a list build', async () => {
    const dispatch = await start({ instances: { mode: 'list', origins: [ORIGIN_A, ORIGIN_B] } });

    expect(printedTexts(dispatch)[GREETING.length]).toBe(
      `Not connected. Type /connect <instance>. Available: ${ORIGIN_A}, ${ORIGIN_B}`,
    );
  });

  it('names an example origin on an open build', async () => {
    const dispatch = await start({ instances: { mode: 'open' } });

    expect(printedTexts(dispatch)[GREETING.length]).toBe(
      'Not connected. Type /connect <instance>, e.g. /connect wired.example',
    );
  });

  it('announces every account under the reports, the active one marked', async () => {
    const detect = vi.fn<Detect>(async (origin: string) => {
      const found = lounge(origin);
      return await Promise.resolve(ok(found));
    });
    const dispatch = await start({
      accounts: [ACCOUNT_A, ACCOUNT_B],
      activeKey: ACCOUNT_A.key,
      detect,
    });

    expect(detect.mock.calls).toStrictEqual([[ORIGIN_A], [ORIGIN_B]]);
    expect(printedTexts(dispatch)).toStrictEqual([
      ...GREETING,
      `Connected to A Lounge (wired) at ${ORIGIN_A}`,
      `Connected to B Lounge (wired) at ${ORIGIN_B}`,
      'Logged in as @lain@a.example (active)',
      'Logged in as @sam@b.example',
    ]);
    expect(actionsOf(dispatch)).toContainEqual({
      type: 'accounts',
      accounts: [ACCOUNT_A, ACCOUNT_B],
      activeKey: ACCOUNT_A.key,
    });
  });

  it('prints the banner first: five decorative lines, then the text alternative', async () => {
    const dispatch = await start({});
    const prints = printedActions(dispatch);

    expect(prints.slice(0, BANNER.length)).toStrictEqual(
      BANNER.map((text) => ({
        type: 'print',
        windowId: STATUS_WINDOW_ID,
        date: NOW,
        level: 'info',
        text,
        decorative: true,
      })),
    );
    expect(prints[BANNER.length]).toStrictEqual({
      type: 'print',
      windowId: STATUS_WINDOW_ID,
      date: NOW,
      level: 'info',
      text: 'WIRED // WIRED',
    });
  });

  it('prints into the status window, stamped at the injected moment', async () => {
    const dispatch = await start({});
    const greeting = actionsOf(dispatch).find((action) => action.type === 'print');

    expect(greeting).toStrictEqual({
      type: 'print',
      windowId: STATUS_WINDOW_ID,
      date: NOW,
      level: 'info',
      text: BANNER[0],
      decorative: true,
    });
  });
});
