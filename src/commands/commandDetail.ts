/**
 * The detail block of one command (WFE-311): its usage, summary, aliases and
 * the keys that run it in the effective keymap (the defaults under the
 * reader's rebinds). `/help <command>` prints it line by line and the
 * suggestion list shows it as a tooltip and in its strip, so both always agree.
 * The usage is the one the registry holds, which already follows the active
 * account's backend (`usageFor`, ./available). Pure; English for now.
 */

import type { Keymap } from './bindingTypes';
import type { CommandDefinition, Registry } from './types';

/** The modes of a keymap, in the order their keys are listed. */
const MODES = ['insert', 'navigation'] as const;

/** Whether the command line {@link line} runs {@link definition}, by its name or an alias. */
function runs(definition: CommandDefinition, line: string): boolean {
  return [definition.name, ...(definition.aliases ?? [])].some(
    (name) => line === `/${name}` || line.startsWith(`/${name} `),
  );
}

/** The `Aliases:` line of {@link definition}, or undefined when it has none. */
function aliasLine(definition: CommandDefinition): string | undefined {
  const aliases = definition.aliases ?? [];
  if (aliases.length === 0) {
    return undefined;
  }
  return `  Aliases: ${aliases.map((alias) => `/${alias}`).join(', ')}`;
}

/** The chords of {@link keymap} that run {@link definition} in {@link mode}. */
function chordsIn(
  definition: CommandDefinition,
  keymap: Keymap,
  mode: (typeof MODES)[number],
): string[] {
  return [...keymap[mode]]
    .filter(([, entry]) => runs(definition, entry.line))
    .map(([chord]) => chord);
}

/** The `Keys:` line of {@link definition} in {@link keymap}, or undefined when nothing runs it. */
function keyLine(definition: CommandDefinition, keymap: Keymap): string | undefined {
  const keys = MODES.flatMap((mode) =>
    chordsIn(definition, keymap, mode).map((chord) => `${chord} (${mode})`),
  );
  return keys.length === 0 ? undefined : `  Keys: ${keys.join(', ')}`;
}

/** The lines of {@link definition}'s detail block: usage, summary, then aliases and keys when it has them. */
export function commandDetailLines(
  definition: CommandDefinition,
  keymap: Keymap,
): readonly string[] {
  const optional = [aliasLine(definition), keyLine(definition, keymap)];
  return [
    definition.usage,
    `  ${definition.summary}`,
    ...optional.filter((line) => line !== undefined),
  ];
}

/** {@link commandDetailLines} as one multi-line text, for a tooltip and the suggestion strip. */
export function commandDetail(definition: CommandDefinition, keymap: Keymap): string {
  return commandDetailLines(definition, keymap).join('\n');
}

/** What a one-line tooltip needs to look a command up: the registry and the effective keymap. */
export type TipSource = {
  readonly registry: Registry;
  readonly keymap: Keymap;
};

/**
 * The tooltip of a button that runs {@link command} (WFE-312): `Action: /command
 * (keys)`, the keys being the distinct chords of the effective keymap in
 * either mode, so a rebind changes it. {@link command} is the text shown, e.g.
 * `feed edit`; its first word names the registry entry. A command the registry
 * lacks, or one nothing is bound to, shows no keys.
 */
export function commandTip(action: string, command: string, source: TipSource): string {
  const definition = source.registry.byName.get(command.replace(/ .*/u, ''));
  const chords =
    definition === undefined
      ? []
      : [...new Set(MODES.flatMap((mode) => chordsIn(definition, source.keymap, mode)))];
  const keys = chords.length === 0 ? '' : ` (${chords.join(', ')})`;
  return `${action}: /${command}${keys}`;
}
