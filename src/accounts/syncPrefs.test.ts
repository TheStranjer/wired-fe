/**
 * Tests for the persisted sync choices: the round trip through a store, the
 * defaults for nothing, junk and a stored list without the flag, and
 * `forget` taking exactly one key out.
 */
import { describe, expect, it } from 'vitest';

import { createSyncStore } from './syncPrefs';
import { createStore } from '../storage/store';
import { memoryBackend } from '../test/memoryBackend';

/** The prefs the round trip stores. */
const PREFS = { syncAccounts: ['https://a.example#1', 'https://b.example#2'], syncEnabled: false };

describe('the sync store', () => {
  it('reads the defaults when nothing is stored', () => {
    const store = createSyncStore(createStore('sync', memoryBackend()));

    expect(store.read()).toStrictEqual({ syncAccounts: [], syncEnabled: true });
  });

  it('round trips what it writes', () => {
    const backend = memoryBackend();

    expect(createSyncStore(createStore('sync', backend)).write(PREFS)).toBe(true);

    expect(createSyncStore(createStore('sync', backend)).read()).toStrictEqual(PREFS);
  });

  it('keeps the choices under their own namespaced key', () => {
    const backend = memoryBackend();

    createSyncStore(createStore('sync', backend)).write(PREFS);

    expect(JSON.parse(backend.getItem('wired:v1:sync:prefs') ?? 'null')).toStrictEqual(PREFS);
  });

  it('reads a stored list without the flag as sync on', () => {
    const backing = createStore('sync', memoryBackend());
    backing.set('prefs', { syncAccounts: ['k'] });

    expect(createSyncStore(backing).read()).toStrictEqual({
      syncAccounts: ['k'],
      syncEnabled: true,
    });
  });

  it('reads the defaults for a stored value of the wrong shape', () => {
    const backing = createStore('sync', memoryBackend());
    backing.set('prefs', { syncAccounts: 'k', syncEnabled: 'yes' });

    expect(createSyncStore(backing).read()).toStrictEqual({ syncAccounts: [], syncEnabled: true });
  });

  it('reports a write that storage refused', () => {
    const store = createSyncStore(createStore('sync', null));

    expect(store.write({ syncAccounts: [], syncEnabled: true })).toBe(false);
  });

  it('forgets one key and keeps the rest in order', () => {
    const store = createSyncStore(createStore('sync', memoryBackend()));
    store.write({ syncAccounts: ['a', 'b', 'c'], syncEnabled: false });

    store.forget('b');

    expect(store.read()).toStrictEqual({ syncAccounts: ['a', 'c'], syncEnabled: false });
  });

  it('writes nothing when the key is not listed', () => {
    const backend = memoryBackend();

    createSyncStore(createStore('sync', backend)).forget('z');

    expect(backend.getItem('wired:v1:sync:prefs')).toBeNull();
  });
});
