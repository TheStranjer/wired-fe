/**
 * Startup finishing the OAuth login the redirect may have left in the address
 * bar (decision 8): before anything is restored, a callback URL is completed
 * through the stores, its outcome printed and its query stripped; a refusal
 * prints as an error and strips the query the same way; a URL that carries no
 * callback prints nothing and keeps its query. Shared helpers mirror
 * startup.test.ts beside this file.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { type Detect, type StartupDeps, runStartup } from './startup';
import type { AppStores } from './stores';
import { createAccountStore } from '../accounts/accountStore';
import { type PendingLogin, savePendingLogin } from '../accounts/pendingLogin';
import { DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import type { WiredConfig } from '../config/schema';
import { ok } from '../lib/result';
import type { AppAction } from '../state/reducer';
import type { Dispatch } from '../state/StateContext';
import { type StorageBackend, createStore } from '../storage/store';
import { server } from '../test/server';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The moment every printed line is stamped with. */
const NOW = new Date('2026-11-15T09:00:00.000Z');

/** The two lines every run opens with. */
const GREETING = ['WIRED // WIRED', 'Present day. Present time.'];

/** The address bar startup is handed, and the URL stripping a callback gives. */
const PATHNAME = '/wiredfe/index.html';
const HASH = '#/home';
const CLEAN_URL = `${PATHNAME}${HASH}`;

/** The instance a login completes on, with its cached app and pending login. */
const ORIGIN = 'https://l.example';
const REDIRECT_URI = 'https://fe.example/';
const APP = { client_id: 'client-abc', client_secret: 'secret-xyz' };
const STATE = '0123456789abcdef0123456789abcdef';
const CALLBACK = `?code=auth-code&state=${STATE}`;
const PENDING: PendingLogin = {
  origin: ORIGIN,
  state: STATE,
  redirectUri: REDIRECT_URI,
  createdAt: NOW.getTime(),
};

/** The account `verify_credentials` answers with during a completing login. */
const ACCOUNT_WIRE = {
  id: '109',
  username: 'lain',
  acct: 'lain',
  fqn: 'lain@l.example',
  display_name: 'Lain',
  created_at: '2024-03-01T00:00:00.000Z',
  note: '<p>hi</p>',
  url: `${ORIGIN}/users/lain`,
  avatar: `${ORIGIN}/avi.png`,
  header: `${ORIGIN}/banner.png`,
  followers_count: 42,
  following_count: 17,
  statuses_count: 12,
};

/** An in-memory storage backend, for stores that really store. */
function createFakeBackend(): StorageBackend {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/** Stores holding {@link APP} and {@link PENDING}: ready to complete {@link CALLBACK}. */
function loginStores(): AppStores {
  const apps = createStore('login-test-apps', createFakeBackend());
  apps.set(`${ORIGIN} ${REDIRECT_URI}`, APP);
  const login = createStore('login-test-login', createFakeBackend());
  savePendingLogin(login, PENDING);

  return {
    apps,
    login,
    accounts: createAccountStore(createStore('login-test-accounts', createFakeBackend())),
    settings: createStore('login-test-settings', null),
  };
}

/** The Wired lounge {@link ORIGIN} answers detection with, titled by its origin. */
const LOUNGE: InstanceProfile = {
  origin: ORIGIN,
  title: ORIGIN,
  capabilities: {
    backend: 'wired',
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(),
  },
};

/** The token exchange and verification a completing login asks the backend for. */
function mockLoginApi(): void {
  server.use(
    http.post(`${ORIGIN}/oauth/token`, () => HttpResponse.json({ access_token: 'token-l' })),
    http.get(`${ORIGIN}/api/v1/accounts/verify_credentials`, () => HttpResponse.json(ACCOUNT_WIRE)),
  );
}

/** One startup over {@link stores} with an address bar carrying {@link search}. */
async function start(options: {
  readonly search: string;
  readonly replaceUrl: (path: string) => void;
  readonly detect?: Detect;
}): Promise<Mock<Dispatch>> {
  const dispatch = vi.fn<Dispatch>();
  const config: WiredConfig = { appName: 'WIRED', instances: { mode: 'same-origin' } };
  const base = {
    dispatch,
    stores: loginStores(),
    config,
    now: () => NOW,
    location: {
      search: options.search,
      pathname: PATHNAME,
      hash: HASH,
      replaceUrl: options.replaceUrl,
    },
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

describe(runStartup, () => {
  it('completes the login the URL describes, then restores and strips the query', async () => {
    mockLoginApi();
    const replaceUrl = vi.fn<(path: string) => void>();
    const detect = vi.fn<Detect>(async () => await Promise.resolve(ok(LOUNGE)));

    const dispatch = await start({ search: CALLBACK, replaceUrl, detect });

    expect(detect.mock.calls).toStrictEqual([[ORIGIN]]);
    expect(printedTexts(dispatch)).toStrictEqual([
      ...GREETING,
      `Logged in to ${ORIGIN} as @lain@l.example`,
      `Connected to ${ORIGIN} (wired) at ${ORIGIN}`,
      'Logged in as @lain@l.example (active)',
    ]);
    expect(replaceUrl).toHaveBeenCalledTimes(1);
    expect(replaceUrl).toHaveBeenCalledWith(CLEAN_URL);
  });

  it('prints a refused login as an error and still strips the query', async () => {
    const replaceUrl = vi.fn<(path: string) => void>();

    const dispatch = await start({
      search: '?error=access_denied&error_description=User%20denied',
      replaceUrl,
    });

    expect(printedTexts(dispatch)).toStrictEqual([
      ...GREETING,
      'Login refused: User denied',
      'Not connected. Type /connect to log in.',
    ]);
    expect(actionsOf(dispatch)).toContainEqual({
      type: 'print',
      windowId: STATUS_WINDOW_ID,
      date: NOW,
      level: 'error',
      text: 'Login refused: User denied',
    });
    expect(replaceUrl).toHaveBeenCalledTimes(1);
    expect(replaceUrl).toHaveBeenCalledWith(CLEAN_URL);
  });

  it('neither prints nor rewrites the URL when it carries no callback', async () => {
    const replaceUrl = vi.fn<(path: string) => void>();

    const dispatch = await start({ search: '?utm_source=matrix', replaceUrl });

    expect(printedTexts(dispatch)).toStrictEqual([
      ...GREETING,
      'Not connected. Type /connect to log in.',
    ]);
    expect(replaceUrl).not.toHaveBeenCalled();
  });
});
