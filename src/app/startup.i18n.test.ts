/**
 * Tests that startup's own lines go through `t()` (WFE-318, decision 19):
 * under a fake language the tagline, the report of an instance, the line per
 * signed-in account and the `/connect` hint of every instance mode follow it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { connectHint } from './connectHint';
import { type Detect, runStartup } from './startup';
import type { AppStores } from './stores';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { createSyncStore } from '../accounts/syncPrefs';
import { DEFAULT_POLL_LIMITS, NO_ANONYMOUS_READS } from '../capabilities/capabilities';
import { ok } from '../lib/result';
import type { Dispatch } from '../state/StateContext';
import { createStore } from '../storage/store';
import { installFakeLocale } from '../test/i18n';

/** The messages startup reads, in the fake language. */
const FAKE = {
  app: {
    connect_hint_list: 'Pick one: {origins}',
    connect_hint_list_custom: 'Pick one or any: {origins}',
    connect_hint_log_in: 'Log in now',
    connect_hint_open: 'Name one',
    connected_to: 'On {title} ({backend}) at {origin}',
    logged_in_as_active: 'You are @{handle} (now)',
    tagline: 'Hello.',
  },
};

const ORIGIN = 'https://a.example';

/** The one signed-in account. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@a.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** The stores of a session whose accounts are {@link accounts}, the first one active. */
function fakeStores(accounts: readonly StoredAccount[]): AppStores {
  const inert = createStore('startup-i18n-test', null);
  return {
    apps: inert,
    login: inert,
    settings: inert,
    profiles: inert,
    sync: createSyncStore(inert),
    accounts: {
      list: () => accounts,
      get: (key) => accounts.find((account) => account.key === key),
      add: (input) => ({ ...input, key: accountKey(input.origin, input.accountId) }),
      updateTokens: () => undefined,
      remove: () => undefined,
      activeKey: () => accounts[0]?.key ?? null,
      setActive: () => undefined,
    },
  };
}

/** The Wired lounge a detection answers with. */
const detect: Detect = async () =>
  await Promise.resolve(
    ok({
      origin: ORIGIN,
      title: 'A Lounge',
      capabilities: {
        backend: 'wired',
        maxCharacters: 500,
        maxMediaAttachments: 4,
        pollLimits: DEFAULT_POLL_LIMITS,
        features: new Set(),
        anonymousReads: NO_ANONYMOUS_READS,
      },
    }),
  );

/** The texts printed by a startup over {@link accounts}. */
async function printed(accounts: readonly StoredAccount[]): Promise<readonly string[]> {
  const dispatch = vi.fn<Dispatch>();
  await runStartup({
    dispatch,
    stores: fakeStores(accounts),
    config: { appName: 'WIRED', instances: { mode: 'same-origin' } },
    now: () => new Date('2026-11-15T09:00:00.000Z'),
    location: { search: '', pathname: '/', hash: '', replaceUrl: () => undefined },
    detect,
  });
  return dispatch.mock.calls.flatMap(([action]) => (action.type === 'print' ? [action.text] : []));
}

describe('startup in another language', () => {
  beforeEach(() => {
    installFakeLocale(FAKE);
  });

  it('words the tagline, the hint and the report of a session with no account', async () => {
    const lines = await printed([]);

    expect(lines).toContain('Hello.');
    expect(lines).toContain('Log in now');
  });

  it('words the report of the instance and the line of the account', async () => {
    const lines = await printed([ACCOUNT]);

    expect(lines).toContain(`On A Lounge (wired) at ${ORIGIN}`);
    expect(lines).toContain('You are @lain@a.example (now)');
  });

  it('words the /connect hint of the other instance modes', () => {
    const origins = ['https://a.example', 'https://b.example'];

    expect(connectHint({ mode: 'open' })).toBe('Name one');
    expect(connectHint({ mode: 'list', origins: [] })).toBe('Name one');
    expect(connectHint({ mode: 'list', origins })).toBe(
      'Pick one: https://a.example, https://b.example',
    );
    expect(connectHint({ mode: 'list', origins, allowCustom: true })).toBe(
      'Pick one or any: https://a.example, https://b.example',
    );
  });
});
