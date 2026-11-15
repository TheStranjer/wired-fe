/**
 * The application's one command registry (decision 6): the definitions
 * src/commands/definitions collects, indexed by src/commands/registry. Reading
 * the command modules happens once, on first use, and the result is shared by
 * every mount, so the command line, /help, tab completion and the keymap all
 * answer to the same registry. A definition file that exports no command, or
 * two commands sharing a name, comes back as `err` naming the offender: the
 * shell prints it once instead of failing to boot.
 */

import { loadDefinitions } from '../commands/definitions';
import { buildRegistry } from '../commands/registry';
import type { Registry } from '../commands/types';
import { type Result, err } from '../lib/result';

/** The result of the one build; undefined until someone first asks for it. */
let cached: Result<Registry, string> | undefined;

/** The definitions in `src/commands/defs` indexed; a failed load is passed through. */
function build(): Result<Registry, string> {
  const definitions = loadDefinitions();
  return definitions.ok ? buildRegistry(definitions.value) : err(definitions.error);
}

/**
 * Every command this bundle ships, built on the first call and shared from
 * then on. `err` names the definition that made building impossible.
 */
export function appRegistry(): Result<Registry, string> {
  const built = cached;
  if (built !== undefined) {
    return built;
  }
  const fresh = build();
  cached = fresh;
  return fresh;
}
