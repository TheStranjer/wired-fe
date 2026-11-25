/**
 * The storage layer (decision 10, AGENTS.md "Security"): the only module in
 * the app that touches `localStorage`. Values are stored as JSON under
 * namespaced, versioned keys (`wired:v1:<namespace>:<key>`), and every read
 * is validated against a valibot schema: anything missing, corrupt, stale or
 * written by someone else reads back as `undefined` instead of entering the
 * app. Nothing here ever logs; failures are silent by design.
 */

import * as v from 'valibot';

/** Version segment every key carries, so a future layout can coexist. */
const KEY_PREFIX = 'wired:v1';

/** The subset of the Web Storage API this module uses. */
export type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Namespaced, validated access to one storage backend. */
export type Store = {
  /** The stored value if present and valid against `schema`, else undefined. */
  readonly get: <T>(key: string, schema: v.GenericSchema<unknown, T>) => T | undefined;
  /** Stores JSON. Returns false when storage is unavailable or full. */
  readonly set: (key: string, value: unknown) => boolean;
  readonly remove: (key: string) => void;
};

/** Narrows an absent storage to `null` (the caller may pass undefined). */
function optionalBackend(storage: StorageBackend | undefined): StorageBackend | null {
  return storage ?? null;
}

/**
 * The backend to use: the explicit one when given (including an explicit
 * `null`), otherwise `globalThis.localStorage`, read inside a `try` because
 * accessing it throws in some private modes. `null` means "no storage".
 */
function resolveBackend(backend: StorageBackend | null | undefined): StorageBackend | null {
  if (backend !== undefined) {
    return backend;
  }

  try {
    return optionalBackend(globalThis.localStorage);
  } catch {
    return null;
  }
}

/** `globalThis.sessionStorage`, or `null` where reading it throws or it is absent. */
function sessionBackend(): StorageBackend | null {
  try {
    return optionalBackend(globalThis.sessionStorage);
  } catch {
    return null;
  }
}

/** Read `fullKey`, parse it as JSON and validate it; `undefined` on any fault. */
function read<T>(
  backend: StorageBackend | null,
  fullKey: string,
  schema: v.GenericSchema<unknown, T>,
): T | undefined {
  if (backend === null) {
    return undefined;
  }

  try {
    const raw = backend.getItem(fullKey);
    if (raw === null) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(raw);
    const result = v.safeParse(schema, parsed);
    return result.success ? result.output : undefined;
  } catch {
    return undefined;
  }
}

/** Write `value` as JSON; false when the backend throws (quota, private mode). */
function write(backend: StorageBackend | null, fullKey: string, value: unknown): boolean {
  if (backend === null) {
    return false;
  }

  try {
    backend.setItem(fullKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Delete `fullKey`, swallowing backend exceptions. */
function drop(backend: StorageBackend | null, fullKey: string): void {
  if (backend === null) {
    return;
  }

  try {
    backend.removeItem(fullKey);
  } catch {
    // Storage that cannot remove is storage the key is already gone from.
  }
}

/**
 * A {@link Store} for one namespace. Keys are stored as
 * `wired:v1:<namespace>:<key>`, so two stores never see each other's data.
 * Omit {@link backend} to persist in `localStorage`; pass `null` (or run
 * where it is unreachable) for a store that simply never stores anything.
 */
export function createStore(namespace: string, backend?: StorageBackend | null): Store {
  const storage = resolveBackend(backend);
  const keyPrefix = `${KEY_PREFIX}:${namespace}:`;

  return {
    get: (key, schema) => read(storage, `${keyPrefix}${key}`, schema),
    set: (key, value) => write(storage, `${keyPrefix}${key}`, value),
    remove: (key) => {
      drop(storage, `${keyPrefix}${key}`);
    },
  };
}

/**
 * A {@link Store} for one namespace that lives in `sessionStorage`: the same
 * keys, validation and silent failures as {@link createStore}, but what it
 * holds is gone when the tab closes. For what is true of a session only, such
 * as what an instance turned out to be (decision 5).
 */
export function createSessionStore(namespace: string): Store {
  return createStore(namespace, sessionBackend());
}
