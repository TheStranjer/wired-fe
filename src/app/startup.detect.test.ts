/**
 * Startup's instance-detection report: once per distinct origin, all of them
 * at once (decision 5); failures printed as an error and dispatching no
 * profile; and, with no detector injected, the real {@link detectInstance}
 * answering. Shared helpers mirror startup.test.ts beside this file.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { type Detect, type StartupDeps, runStartup } from './startup';
import type { AppStores } from './stores';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import type { InstancesConfig, WiredConfig } from '../config/schema';
import { err, ok } from '../lib/result';
import type { AppAction } from '../state/reducer';
import type { Dispatch } from '../state/StateContext';
import { createStore } from '../storage/store';
import { server } from '../test/server';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The moment every printed line is stamped with. */
const NOW = new Date('2026-11-15T09:00:00.000Z');

const ORIGIN_A = 'https://a.example';
const ORIGIN_B = 'https://b.example';

/** Two accounts on {@link ORIGIN_A} and one on {@link ORIGIN_B}. */
const ACCOUNT_A: StoredAccount = {
  key: accountKey(ORIGIN_A, '1'),
  origin: ORIGIN_A,
  accountId: '1',
  handle: 'lain@a.example',
  token: 'token-a',
};
const ACCOUNT_A2: StoredAccount = {
  key: accountKey(ORIGIN_A, '2'),
  origin: ORIGIN_A,
  accountId: '2',
  handle: 'ali@a.example',
  token: 'token-a2',
};
const ACCOUNT_B: StoredAccount = {
  key: accountKey(ORIGIN_B, '2'),
  origin: ORIGIN_B,
  accountId: '2',
  handle: 'sam@b.example',
  token: 'token-b',
};

/** A Mastodon profile of {@link origin} titled {@link title}, with no features. */
function profileOf(origin: string, title: string): InstanceProfile {
  return {
    origin,
    title,
    capabilities: {
      backend: 'mastodon',
      maxCharacters: 500,
      maxMediaAttachments: 4,
      pollLimits: DEFAULT_POLL_LIMITS,
      features: new Set(),
    },
  };
}

const PROFILE_B = profileOf(ORIGIN_B, 'B Lounge');

/** The four stores; the accounts one answers {@link accounts}. */
function fakeStores(accounts: readonly StoredAccount[]): AppStores {
  const inert = createStore('startup-test', null);
  return {
    apps: inert,
    login: inert,
    settings: inert,
    accounts: {
      list: () => accounts,
      get: (key) => accounts.find((account) => account.key === key),
      add: (input) => ({ ...input, key: accountKey(input.origin, input.accountId) }),
      remove: () => undefined,
      activeKey: () => null,
      setActive: () => undefined,
    },
  };
}

/** A detector answering with the {@link profiles} it knows, failing on the rest. */
function detectWith(profiles: ReadonlyMap<string, InstanceProfile>): Detect {
  return async (origin: string) => {
    const found = profiles.get(origin);
    return await Promise.resolve(
      found === undefined ? err({ kind: 'network', message: `no ${origin}` }) : ok(found),
    );
  };
}

/** One startup against fake stores; {@link options.detect} omitted means the real one. */
async function start(options: {
  readonly accounts: readonly StoredAccount[];
  readonly instances?: InstancesConfig;
  readonly detect?: Detect;
}): Promise<Mock<Dispatch>> {
  const dispatch = vi.fn<Dispatch>();
  const instances: InstancesConfig = options.instances ?? { mode: 'same-origin' };
  const config: WiredConfig = { appName: 'WIRED', instances };
  const base = {
    dispatch,
    stores: fakeStores(options.accounts),
    config,
    now: () => NOW,
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

/** The `print` member of {@link AppAction}, the shape of every startup line. */
type PrintAction = Extract<AppAction, { readonly type: 'print' }>;

/** The print actions, in order. */
function printedLines(dispatch: Mock<Dispatch>): readonly PrintAction[] {
  return actionsOf(dispatch).filter((action): action is PrintAction => action.type === 'print');
}

/** The printed texts, in order. */
function printedTexts(dispatch: Mock<Dispatch>): readonly string[] {
  return printedLines(dispatch).map((action) => action.text);
}

/** The dispatched profiles, in the order the reports came in. */
function profilesOf(dispatch: Mock<Dispatch>): readonly InstanceProfile[] {
  return actionsOf(dispatch).flatMap((action) =>
    action.type === 'profile' ? [action.profile] : [],
  );
}

/** The gate of the concurrency test: it opens only when {@link expected} arrive. */
function arrivalGate(expected: number): {
  readonly arrive: () => Promise<void>;
  readonly arrived: () => number;
} {
  const allArrived = Promise.withResolvers<undefined>();
  let count = 0;
  return {
    arrive: async () => {
      count += 1;
      if (count === expected) {
        allArrived.resolve(undefined);
      }
      await allArrived.promise;
    },
    arrived: () => count,
  };
}

describe(runStartup, () => {
  it('detects an origin shared by two accounts exactly once', async () => {
    const profileA = profileOf(ORIGIN_A, 'A Lounge');
    const detect = vi.fn<Detect>(detectWith(new Map([[ORIGIN_A, profileA]])));
    const dispatch = await start({ accounts: [ACCOUNT_A, ACCOUNT_A2], detect });

    expect(detect).toHaveBeenCalledTimes(1);
    expect(printedTexts(dispatch)).toStrictEqual([
      'WIRED // WIRED',
      'Present day. Present time.',
      `Connected to A Lounge (mastodon) at ${ORIGIN_A}`,
      'Logged in as @lain@a.example',
      'Logged in as @ali@a.example',
    ]);
  });

  it('runs the detections concurrently', async () => {
    const gate = arrivalGate(2);
    const detect: Detect = async (origin: string) => {
      await gate.arrive();
      return ok(profileOf(origin, 'Shared Lounge'));
    };

    await start({ accounts: [ACCOUNT_A, ACCOUNT_B], detect });

    expect(gate.arrived()).toBe(2);
  });

  it('prints a failed detection as an error and dispatches no profile for it', async () => {
    const dispatch = await start({
      accounts: [ACCOUNT_A, ACCOUNT_B],
      detect: detectWith(new Map([[ORIGIN_B, PROFILE_B]])),
    });

    const failures = printedLines(dispatch).filter((line) => line.level === 'error');

    expect(failures).toStrictEqual([
      {
        type: 'print',
        windowId: STATUS_WINDOW_ID,
        date: NOW,
        level: 'error',
        text: `Could not reach ${ORIGIN_A}: Network error: no ${ORIGIN_A}`,
      },
    ]);
    expect(profilesOf(dispatch)).toStrictEqual([PROFILE_B]);
    expect(printedTexts(dispatch)).toStrictEqual([
      'WIRED // WIRED',
      'Present day. Present time.',
      `Could not reach ${ORIGIN_A}: Network error: no ${ORIGIN_A}`,
      `Connected to B Lounge (mastodon) at ${ORIGIN_B}`,
      'Logged in as @lain@a.example',
      'Logged in as @sam@b.example',
    ]);
  });

  it('falls back to the real instance detection when none is injected', async () => {
    const failing = () => HttpResponse.json({ error: 'gone' }, { status: 503 });
    server.use(
      http.get(`${ORIGIN_A}/.well-known/nodeinfo`, failing),
      http.get(`${ORIGIN_A}/api/v1/instance`, failing),
      http.get(`${ORIGIN_A}/api/v2/instance`, failing),
    );

    const dispatch = await start({ accounts: [ACCOUNT_A] });

    expect(printedTexts(dispatch)).toStrictEqual([
      'WIRED // WIRED',
      'Present day. Present time.',
      `Could not reach ${ORIGIN_A}: HTTP 503: gone`,
      'Logged in as @lain@a.example',
    ]);
  });
});
