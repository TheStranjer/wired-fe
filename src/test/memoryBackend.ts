/**
 * An in-memory {@link StorageBackend} for tests that need a store to keep what
 * it is given (a store over a `null` backend keeps nothing). Test wiring only.
 */
import type { StorageBackend } from '../storage/store';

/** A fresh backend over a Map; nothing reaches the real storage. */
export function memoryBackend(): StorageBackend {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}
