/**
 * Tests for the first-run stream feed through the whole of startup (WFE-243):
 * with accounts signed in and no feeds saved, no saved desk and no earlier
 * stream, the `stream` feed is made for every account and opened alone — no
 * home window — and the settings that remember it are saved; a saved desk, a
 * stream made and deleted before, or no accounts at all leave things alone.
 */
import { describe, expect, it, vi } from 'vitest';

import type { DeskSource } from './deskSource';
import { type Detect, type StartupDeps, runStartup } from './startup';
import type { AppStores } from './stores';
import type { StoredAccount } from '../accounts/accountStore';
import { createSyncStore } from '../accounts/syncPrefs';
import { err } from '../lib/result';
import { toSnapshot } from '../state/deskSnapshot';
import type { AppAction } from '../state/reducer';
import type { Dispatch } from '../state/StateContext';
import { createStore } from '../storage/store';
import { BOB, LAIN, builtDesk } from '../test/deskFixtures';
import { memoryBackend } from '../test/memoryBackend';

/** The stores: {@link accounts} signed in (Lain active) and {@link settings} saved, if any. */
function fakeStores(accounts: readonly StoredAccount[], settings: unknown): AppStores {
  const inert = createStore('startup-stream-test', null);
  const saved = createStore('startup-stream-settings', memoryBackend());
  if (settings !== undefined) {
    saved.set('settings', settings);
  }
  return {
    apps: inert,
    login: inert,
    settings: saved,
    profiles: inert,
    sync: createSyncStore(inert),
    accounts: {
      list: () => accounts,
      get: (key) => accounts.find((account) => account.key === key),
      add: (input) => ({ ...input, key: `${input.origin}#${input.accountId}` }),
      updateTokens: () => undefined,
      remove: () => undefined,
      activeKey: () => (accounts.length === 0 ? null : LAIN.key),
      setActive: () => undefined,
    },
  };
}

/** One startup over {@link accounts}, {@link settings} and {@link desk}; no instance answers. */
async function start(
  accounts: readonly StoredAccount[],
  settings?: unknown,
  desk?: DeskSource,
): Promise<readonly AppAction[]> {
  const dispatch = vi.fn<Dispatch>();
  const detect = vi.fn<Detect>(
    async () => await Promise.resolve(err({ kind: 'network', message: 'offline' })),
  );
  const base = {
    dispatch,
    stores: fakeStores(accounts, settings),
    config: { appName: 'WIRED', instances: { mode: 'same-origin' } },
    now: () => new Date('2026-11-25T10:00:00.000Z'),
    location: { search: '', pathname: '/', hash: '', replaceUrl: () => undefined },
    detect,
  } satisfies StartupDeps;
  await runStartup(desk === undefined ? base : { ...base, desk });
  return dispatch.mock.calls.map(([action]) => action);
}

/** The titles of the windows the asks open, in order. */
function opened(actions: readonly AppAction[]): readonly string[] {
  return actions.flatMap((action) =>
    action.type === 'windows' && action.action.type === 'open' ? [action.action.title] : [],
  );
}

/** The feeds a `settings` ask saves, when one does. */
function savedFeeds(actions: readonly AppAction[]): unknown {
  return actions.flatMap((action) =>
    action.type === 'settings' && action.settings.feeds !== undefined
      ? [action.settings.feeds]
      : [],
  )[1];
}

describe('startup on a first run', () => {
  it('makes the stream of every account, saves that it was made and opens it alone', async () => {
    const actions = await start([LAIN, BOB]);

    expect(opened(actions)).toStrictEqual(['~stream']);
    expect(actions).toContainEqual({
      type: 'settings',
      settings: {
        streamMade: true,
        feeds: [expect.objectContaining({ id: 'f1', name: 'stream', auto: true }) as unknown],
      },
    });
    expect(savedFeeds(actions)).toHaveLength(1);
  });

  it('puts the accounts in the state before it opens the stream', async () => {
    const types = (await start([LAIN])).map((action) => action.type);

    expect(types.indexOf('accounts')).toBeLessThan(types.indexOf('windows'));
  });

  it('opens the stream again on the next start while it is still automatic', async () => {
    const first = await start([LAIN]);
    const feeds = savedFeeds(first);

    const second = await start([LAIN], { feeds, streamMade: true });

    expect(opened(second)).toStrictEqual(['~stream']);
    expect(second.filter((action) => action.type === 'settings')).toHaveLength(1);
  });
});

describe('startup that leaves the stream out', () => {
  it('makes nothing for a reader who deleted their stream earlier', async () => {
    const actions = await start([LAIN], { streamMade: true });

    expect(opened(actions)).toStrictEqual(['home', 'notifs']);
    expect(savedFeeds(actions)).toBeUndefined();
  });

  it('makes nothing for a reader who already has feeds', async () => {
    const feeds = [{ id: 'f1', name: 'main', sources: [] }];

    const actions = await start([LAIN], { feeds });

    expect(opened(actions)).toStrictEqual(['home', 'notifs']);
  });

  it('makes nothing while nobody is signed in', async () => {
    const actions = await start([]);

    expect(opened(actions)).toStrictEqual([]);
  });

  it('makes nothing when a saved desk is restored', async () => {
    const store = createStore('desk', memoryBackend());
    store.set('desktop', toSnapshot(builtDesk(), 5));

    const actions = await start([LAIN, BOB], undefined, { store, deviceClass: 'desktop' });

    expect(opened(actions)).toStrictEqual([]);
    expect(savedFeeds(actions)).toBeUndefined();
  });
});
