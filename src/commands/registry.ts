/**
 * The command registry (decision 6): validates the collected definitions
 * once and indexes every name and alias. A malformed name or a name clash is
 * a programming error in a definition file, so building the registry fails
 * loudly, naming the offender, instead of shadowing a command. The
 * {@link Registry} shape itself is part of the layer's vocabulary and lives in
 * types.ts, which keeps this module and the commands a one-way import.
 */

import type { CommandDefinition, Registry } from './types';
import { type Result, err, ok } from '../lib/result';

/** A command name or alias as it must be written: a letter, then letters, digits, hyphens. */
const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Sort definitions by name so the registry and /help are stable. */
function compareNames(a: CommandDefinition, b: CommandDefinition): number {
  return a.name.localeCompare(b.name);
}

/**
 * Index {@link definitions} by name and alias. Returns err naming the
 * offender when a name or alias does not match the pattern, when two commands
 * share a name, or when an alias equals any name or another alias.
 */
export function buildRegistry(definitions: readonly CommandDefinition[]): Result<Registry, string> {
  const byName = new Map<string, CommandDefinition>();
  for (const definition of definitions) {
    for (const label of [definition.name, ...definition.aliases]) {
      if (!NAME_PATTERN.test(label)) {
        const kind = label === definition.name ? 'name' : 'alias';
        return err(`Invalid ${kind}: /${label} (in command /${definition.name})`);
      }
      const existing = byName.get(label);
      if (existing !== undefined) {
        return err(`Duplicate name: /${label} (already used by /${existing.name})`);
      }
      byName.set(label, definition);
    }
  }
  return ok({ commands: definitions.toSorted(compareNames), byName });
}

/** Find the command known as {@link name}; callers pass lowercase names. */
export function lookupCommand(registry: Registry, name: string): CommandDefinition | undefined {
  return registry.byName.get(name);
}
