/**
 * Unit tests for the storage layer: key namespacing, JSON round trips behind
 * schema validation, and the failure modes of storage that is missing,
 * corrupt, hostile or unreachable.
 */

import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';

import { type StorageBackend, createSessionStore, createStore } from './store';

const SettingsSchema = v.object({ theme: v.string(), volume: v.number() });
const PLAYER = { theme: 'lain', volume: 11 };

/** An in-memory backend over a Map, whose keys the tests can inspect. */
type FakeBackend = StorageBackend & { readonly entries: Map<string, string> };

function createFakeBackend(): FakeBackend {
  const entries = new Map<string, string>();

  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/** A backend where every call throws, like storage in hostile private modes. */
function createThrowingBackend(): StorageBackend {
  const explode = (): never => {
    throw new Error('storage is unavailable');
  };

  return { getItem: explode, removeItem: explode, setItem: explode };
}

/** Runs `task` while reading `globalThis.localStorage` throws, then restores. */
function withLocalStorageUnreachable<T>(task: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get(): never {
      throw new Error('SecurityError: localStorage is disabled');
    },
  });

  try {
    return task();
  } finally {
    if (original === undefined) {
      Reflect.deleteProperty(globalThis, 'localStorage');
    } else {
      Object.defineProperty(globalThis, 'localStorage', original);
    }
  }
}

describe(createStore, () => {
  it('stores keys as wired:v1:<namespace>:<key> and values as JSON', () => {
    const backend = createFakeBackend();
    const store = createStore('accounts', backend);

    expect(store.set('last', 'lain@wired.example')).toBe(true);
    expect([...backend.entries.keys()]).toStrictEqual(['wired:v1:accounts:last']);
    expect(backend.entries.get('wired:v1:accounts:last')).toBe('"lain@wired.example"');
  });

  it('round-trips a value through a v.object schema', () => {
    const store = createStore('settings', createFakeBackend());

    expect(store.set('player', PLAYER)).toBe(true);
    expect(store.get('player', SettingsSchema)).toStrictEqual(PLAYER);
  });

  it('reads undefined for a key that was never stored', () => {
    const store = createStore('settings', createFakeBackend());

    expect(store.get('player', SettingsSchema)).toBeUndefined();
  });

  it('reads undefined when the stored text is not JSON', () => {
    const backend = createFakeBackend();
    const store = createStore('settings', backend);

    backend.entries.set('wired:v1:settings:player', '{not json');

    expect(store.get('player', SettingsSchema)).toBeUndefined();
  });

  it('reads undefined when the stored value fails the schema', () => {
    const store = createStore('settings', createFakeBackend());

    store.set('player', { theme: 3, volume: 'loud' });

    expect(store.get('player', SettingsSchema)).toBeUndefined();
  });

  it('returns false when the value cannot be stringified', () => {
    const store = createStore('settings', createFakeBackend());
    const cyclic: Record<string, unknown> = {};

    cyclic['self'] = cyclic;

    expect(store.set('loop', cyclic)).toBe(false);
  });

  it('removes a stored key', () => {
    const backend = createFakeBackend();
    const store = createStore('settings', backend);

    store.set('player', PLAYER);
    store.remove('player');

    expect(backend.entries.size).toBe(0);
    expect(store.get('player', SettingsSchema)).toBeUndefined();
  });

  it('hides what one namespace stored from another', () => {
    const backend = createFakeBackend();
    const accounts = createStore('accounts', backend);
    const settings = createStore('settings', backend);

    accounts.set('token', 'abc123');

    expect(settings.get('token', v.string())).toBeUndefined();
    expect([...backend.entries.keys()]).toStrictEqual(['wired:v1:accounts:token']);
  });

  it('degrades on a backend that throws on every call', () => {
    const store = createStore('settings', createThrowingBackend());

    expect(store.get('player', SettingsSchema)).toBeUndefined();
    expect(store.set('player', PLAYER)).toBe(false);
    expect(() => {
      store.remove('player');
    }).not.toThrow();
  });

  it('does nothing at all with a null backend', () => {
    const store = createStore('settings', null);

    expect(store.set('player', PLAYER)).toBe(false);
    expect(store.get('player', SettingsSchema)).toBeUndefined();
    expect(() => {
      store.remove('player');
    }).not.toThrow();
  });

  it('falls back to globalThis.localStorage when no backend is given', () => {
    const store = createStore('defaults');

    expect(store.set('seen', true)).toBe(true);
    expect(globalThis.localStorage.getItem('wired:v1:defaults:seen')).toBe('true');

    store.remove('seen');

    expect(store.get('seen', v.boolean())).toBeUndefined();
  });

  it('behaves like no storage when reading localStorage throws', () => {
    const outcomes = withLocalStorageUnreachable(() => {
      const store = createStore('ns');
      return [store.set('player', PLAYER), store.get('player', SettingsSchema)] as const;
    });

    expect(outcomes).toStrictEqual([false, undefined]);
  });

  it('behaves like no storage when localStorage is absent', () => {
    vi.stubGlobal('localStorage', undefined);
    const store = createStore('ns');
    const outcomes: [boolean, unknown] = [
      store.set('player', PLAYER),
      store.get('player', SettingsSchema),
    ];

    expect(outcomes).toStrictEqual([false, undefined]);
  });
});

describe(createSessionStore, () => {
  it('keeps its values in sessionStorage, not localStorage, under the same key layout', () => {
    const store = createSessionStore('profiles');

    expect(store.set('seen', true)).toBe(true);
    expect(globalThis.sessionStorage.getItem('wired:v1:profiles:seen')).toBe('true');
    expect(globalThis.localStorage.getItem('wired:v1:profiles:seen')).toBeNull();
    expect(store.get('seen', v.boolean())).toBe(true);

    store.remove('seen');

    expect(store.get('seen', v.boolean())).toBeUndefined();
  });

  it('behaves like no storage when reading sessionStorage throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get(): never {
        throw new Error('SecurityError: sessionStorage is disabled');
      },
    });

    try {
      const store = createSessionStore('profiles');

      expect([store.set('seen', true), store.get('seen', v.boolean())]).toStrictEqual([
        false,
        undefined,
      ]);
    } finally {
      if (original !== undefined) {
        Object.defineProperty(globalThis, 'sessionStorage', original);
      }
    }
  });

  it('behaves like no storage when sessionStorage is absent', () => {
    vi.stubGlobal('sessionStorage', undefined);
    const store = createSessionStore('profiles');

    expect([store.set('seen', true), store.get('seen', v.boolean())]).toStrictEqual([
      false,
      undefined,
    ]);
  });
});
