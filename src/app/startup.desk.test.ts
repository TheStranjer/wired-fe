/**
 * Tests for startup and the saved desk (decision 17): with a desk saved for
 * this device class, startup restores it after the accounts are in the state
 * and opens no default windows; with none, a corrupt one, another device
 * class's or no source at all, the default windows open as before.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import type { DeskSource } from './deskSource';
import { type Detect, type StartupDeps, runStartup } from './startup';
import type { AppStores } from './stores';
import { createSyncStore } from '../accounts/syncPrefs';
import { err } from '../lib/result';
import { toSnapshot } from '../state/deskSnapshot';
import type { AppAction } from '../state/reducer';
import type { Dispatch } from '../state/StateContext';
import { createStore } from '../storage/store';
import type { Store } from '../storage/store';
import { BOB, BOB_HOME_ID, LAIN, builtDesk } from '../test/deskFixtures';
import { memoryBackend } from '../test/memoryBackend';

/** The four stores, the accounts one answering Lain and Bob with Lain active. */
function fakeStores(): AppStores {
  const inert = createStore('startup-desk-test', null);
  const accounts = [LAIN, BOB];
  return {
    apps: inert,
    login: inert,
    settings: inert,
    profiles: inert,
    sync: createSyncStore(inert),
    accounts: {
      list: () => accounts,
      get: (key) => accounts.find((account) => account.key === key),
      add: (input) => ({ ...input, key: `${input.origin}#${input.accountId}` }),
      updateTokens: () => undefined,
      remove: () => undefined,
      activeKey: () => LAIN.key,
      setActive: () => undefined,
    },
  };
}

/** A desk store holding the built desk under {@link key}. */
function savedDesk(key: string): Store {
  const store = createStore('desk', memoryBackend());
  store.set(key, toSnapshot(builtDesk(), 5));
  return store;
}

/** One startup over {@link desk}; detection never finds anything out. */
async function start(desk: DeskSource | undefined): Promise<Mock<Dispatch>> {
  const dispatch = vi.fn<Dispatch>();
  const detect = vi.fn<Detect>(
    async () => await Promise.resolve(err({ kind: 'network', message: 'offline' })),
  );
  const base = {
    dispatch,
    stores: fakeStores(),
    config: { appName: 'WIRED', instances: { mode: 'same-origin' } },
    now: () => new Date('2026-11-15T09:00:00.000Z'),
    location: { search: '', pathname: '/', hash: '', replaceUrl: () => undefined },
    detect,
  } satisfies StartupDeps;
  await runStartup(desk === undefined ? base : { ...base, desk });
  return dispatch;
}

/** The types of the actions the recording {@link dispatch} was asked for, in order. */
function typesOf(dispatch: Mock<Dispatch>): readonly AppAction['type'][] {
  return dispatch.mock.calls.map(([action]) => action.type);
}

/** The restore actions among the asks. */
function restores(dispatch: Mock<Dispatch>): readonly AppAction[] {
  return dispatch.mock.calls
    .map(([action]) => action)
    .filter((action) => action.type === 'restore');
}

describe('startup with a saved desk', () => {
  it('restores the desk for this device class after the accounts, in place of the defaults', async () => {
    const dispatch = await start({ store: savedDesk('desktop'), deviceClass: 'desktop' });

    const types = typesOf(dispatch);

    expect(types.indexOf('restore')).toBe(types.indexOf('accounts') + 1);
    expect(types).not.toContain('windows');
    expect(restores(dispatch)).toHaveLength(1);
  });

  it('restores the windows of the signed-in accounts', async () => {
    const dispatch = await start({ store: savedDesk('desktop'), deviceClass: 'desktop' });

    const [restore] = restores(dispatch);

    expect(restore?.type === 'restore' && restore.windows.activeId).toBe(BOB_HOME_ID);
  });

  it('opens the default windows when this device class has no saved desk', async () => {
    const dispatch = await start({ store: savedDesk('mobile'), deviceClass: 'desktop' });

    expect(typesOf(dispatch)).toContain('windows');
    expect(restores(dispatch)).toHaveLength(0);
  });

  it('opens the default windows when the saved desk is corrupt', async () => {
    const store = createStore('desk', memoryBackend());
    store.set('desktop', { version: 2, windows: 'many' });

    const dispatch = await start({ store, deviceClass: 'desktop' });

    expect(typesOf(dispatch)).toContain('windows');
    expect(restores(dispatch)).toHaveLength(0);
  });

  it('opens the default windows when there is nowhere to read a desk from', async () => {
    const dispatch = await start(undefined);

    expect(typesOf(dispatch)).toContain('windows');
    expect(restores(dispatch)).toHaveLength(0);
  });
});
