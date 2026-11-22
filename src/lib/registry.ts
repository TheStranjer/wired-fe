/**
 * The loader loop shared by the self-registering registries (window kinds,
 * commands): collect the exports of a glob in path order, checking each one
 * against a guard.
 */

import { type Result, err, ok } from './result';

/**
 * Collect the globbed `modules` as `[path, value]` pairs sorted by path. The
 * first value that fails `isT` stops the collection with an err naming its
 * path and what it should have exported (`label`, e.g. `a command`). No
 * modules at all is an empty list.
 */
export function collectModules<T>(
  modules: Readonly<Record<string, unknown>>,
  isT: (value: unknown) => value is T,
  label: string,
): Result<readonly (readonly [string, T])[], string> {
  const collected: (readonly [string, T])[] = [];
  for (const path of Object.keys(modules).sort((a, b) => a.localeCompare(b))) {
    const value = modules[path];
    if (!isT(value)) {
      return err(`${path} does not export ${label}`);
    }
    collected.push([path, value]);
  }
  return ok(collected);
}
