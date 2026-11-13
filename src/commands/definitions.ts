/**
 * Loader for the command definitions (decision 6). Each command lives in its
 * own file `src/commands/defs/<name>.ts` and self-registers by exporting
 * `command`; the glob in loadDefinitions collects them at build time, so
 * adding a command never edits a shared list. knip cannot follow the glob, so
 * knip.json lists the definition files as entry files.
 */

import type { CommandDefinition } from './types';
import { type Result, err, ok } from '../lib/result';

/** Whether a value is a string-keyed object, e.g. a module namespace. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/**
 * Whether a value is a command definition: an object with a string `name`
 * and a function `run`. The remaining fields are the definition file's own
 * business; registry.ts validates what it runs on.
 */
function isDefinition(value: unknown): value is CommandDefinition {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value['name'] === 'string' && typeof value['run'] === 'function';
}

/** The `command` export of a globbed module, when it has the definition shape. */
function commandOf(module: unknown): CommandDefinition | undefined {
  if (!isRecord(module)) {
    return undefined;
  }
  const command = module['command'];
  return isDefinition(command) ? command : undefined;
}

/**
 * Collect the `command` export of every module, ordered by path. A module
 * without one is a programming error: returns err naming the path.
 */
export function collectDefinitions(
  modules: Readonly<Record<string, unknown>>,
): Result<readonly CommandDefinition[], string> {
  const definitions: CommandDefinition[] = [];
  for (const path of Object.keys(modules).sort((a, b) => a.localeCompare(b))) {
    const command = commandOf(modules[path]);
    if (command === undefined) {
      return err(`${path} does not export a command`);
    }
    definitions.push(command);
  }
  return ok(definitions);
}

/**
 * The definitions in `src/commands/defs`. Test files are excluded from the
 * glob: they export no `command` and would otherwise fail collection.
 */
export function loadDefinitions(): Result<readonly CommandDefinition[], string> {
  const modules = import.meta.glob(['./defs/*.ts', '!./defs/*.test.ts'], { eager: true });
  return collectDefinitions(modules);
}
