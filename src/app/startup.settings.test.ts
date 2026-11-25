/**
 * Tests for startup restoring settings: the record the settings store holds
 * under `settings` is dispatched into the app state before anything prints;
 * a partial record comes back with its defaults filled; and where storage
 * holds nothing — or nothing valid — the defaults are dispatched all the
 * same, so the shell never renders a session without settings.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { type StartupDeps, runStartup } from './startup';
import type { AppStores } from './stores';
import type { StoredAccount } from '../accounts/accountStore';
import { createSyncStore } from '../accounts/syncPrefs';
import type { AppAction } from '../state/reducer';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import type { Dispatch } from '../state/StateContext';
import { type StorageBackend, createStore } from '../storage/store';

/** The moment every printed line is stamped with. */
const NOW = new Date('2026-11-15T09:00:00.000Z');

/** A session that had turned every knob before it left. */
const CHOSEN: Settings = {
  avatars: false,
  clockFormat: '12h',
  defaultVisibility: 'unlisted',
  density: 'lines',
  effects: true,
  expandMedia: false,
  feeds: [{ id: 'f1', name: 'main', sources: [{ accountKey: 'a#1', source: 'home' }] }],
  images: false,
  keyOverrides: [{ mode: 'navigation', chord: 'Ctrl+e', line: '/fav' }],
  openIn: 'float',
  openInByKind: { thread: 'vsplit' },
  theme: 'bnet',
};

/** An in-memory storage backend, for a store that really stores. */
function memoryBackend(): StorageBackend {
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

/** The four stores; nobody signed in, settings in {@link backend}. */
function storesFor(backend: StorageBackend | null): AppStores {
  const inert = createStore('startup-settings-test', null);
  const noAccounts: readonly StoredAccount[] = [];
  return {
    apps: inert,
    login: inert,
    settings: createStore('startup-settings', backend),
    profiles: createStore('startup-profiles', null),
    sync: createSyncStore(createStore('startup-sync', null)),
    accounts: {
      list: () => noAccounts,
      get: () => undefined,
      add: (input) => ({ ...input, key: `${input.origin}#x` }),
      updateTokens: () => undefined,
      remove: () => undefined,
      activeKey: () => null,
      setActive: () => undefined,
    },
  };
}

/** One startup over {@link backend}; returns the recorded dispatch. */
async function startWith(backend: StorageBackend | null): Promise<Mock<Dispatch>> {
  const dispatch = vi.fn<Dispatch>();
  const deps: StartupDeps = {
    dispatch,
    stores: storesFor(backend),
    config: { appName: 'WIRED', instances: { mode: 'same-origin' } },
    now: () => NOW,
    location: { search: '', pathname: '/', hash: '', replaceUrl: () => undefined },
  };

  await runStartup(deps);
  return dispatch;
}

/** Every action the recording {@link dispatch} was asked for, in order. */
function actionsOf(dispatch: Mock<Dispatch>): readonly AppAction[] {
  return dispatch.mock.calls.map(([action]) => action);
}

/** Startup over a settings store already holding {@link value}, verbatim. */
async function startStoring(value: unknown): Promise<Mock<Dispatch>> {
  const backend = memoryBackend();
  createStore('startup-settings', backend).set('settings', value);
  return await startWith(backend);
}

describe('startup restoring settings', () => {
  it('dispatches the stored record as its very first action', async () => {
    const dispatch = await startStoring(CHOSEN);

    expect(actionsOf(dispatch)[0]).toStrictEqual({ type: 'settings', settings: CHOSEN });
  });

  it('dispatches the defaults where storage holds nothing', async () => {
    const dispatch = await startWith(memoryBackend());

    expect(actionsOf(dispatch)[0]).toStrictEqual({
      type: 'settings',
      settings: DEFAULT_SETTINGS,
    });
  });

  it('falls back to the defaults when the stored record is junk', async () => {
    const dispatch = await startStoring({ clockFormat: 25, effects: 'yes' });

    expect(actionsOf(dispatch)[0]).toStrictEqual({
      type: 'settings',
      settings: DEFAULT_SETTINGS,
    });
  });

  it('fills the defaults around a partial record', async () => {
    const dispatch = await startStoring({ effects: true });

    expect(actionsOf(dispatch)[0]).toStrictEqual({
      type: 'settings',
      settings: { ...DEFAULT_SETTINGS, effects: true },
    });
  });

  it('reads settings before it prints its first line', async () => {
    const types = actionsOf(await startStoring(CHOSEN)).map((action) => action.type);

    expect(types.indexOf('settings')).toBe(0);
    expect(types.indexOf('print')).toBeGreaterThan(0);
  });
});
