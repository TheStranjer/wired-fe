/**
 * The keymap (decision 6): one hotkey map per mode (AGENTS.md "Two hotkey
 * modes"), generated from the default bindings declared across the command
 * registry and the reader's own overrides (WFE-130, `/bind`). Chords are
 * canonical sequences of one or more chords (decision 18, see ./chord, e.g.
 * `Ctrl+B %`) and every entry names the command line the
 * chord carries — to run, or to fill into the command line when the binding is
 * a prefill — so a hotkey and the typed command are one path.
 *
 * A binding that cannot work is reported in `problems` (for the status
 * window) instead of installed: a chord that is not canonical, one that would
 * swallow typing in insert mode, one an earlier command already took, or a
 * sequence that is a strict prefix of another (`w` beside `w v`) or has one as
 * its prefix. The first binding of a chord wins, in registry order; overrides come after the
 * defaults and replace, add to, or — with a null line — delete their chord.
 */

import { blocksTyping, parseSequence } from './chord';
import { conflictingSequence } from './sequence';
import type { CommandBinding, Keymap, KeymapEntry } from '../commands/bindingTypes';
import type { CommandDefinition, Registry } from '../commands/types';
import { t } from '../i18n/translate';
import type { KeyOverride } from '../lib/keyOverride';

/** The keymap under construction: the finished shape with mutable collections. */
type PartialKeymap = {
  readonly insert: Map<string, KeymapEntry>;
  readonly navigation: Map<string, KeymapEntry>;
  readonly problems: string[];
};

/** The command line {@link binding} of {@link definition} runs. */
function commandLine(definition: CommandDefinition, binding: CommandBinding): string {
  return binding.args === '' ? `/${definition.name}` : `/${definition.name} ${binding.args}`;
}

/** Why {@link binding} cannot be installed, or null when it can. */
function bindingProblem(definition: CommandDefinition, binding: CommandBinding): string | null {
  if (parseSequence(binding.chord) !== binding.chord) {
    return t('keys.invalid_key', { command: definition.name, chord: binding.chord });
  }
  if (binding.mode === 'insert' && blocksTyping(binding.chord)) {
    return t('keys.would_block_typing', { command: definition.name, chord: binding.chord });
  }
  return null;
}

/** The map of {@link mode} under construction in {@link target}. */
function modeMap(target: PartialKeymap, mode: KeyOverride['mode']): Map<string, KeymapEntry> {
  return mode === 'insert' ? target.insert : target.navigation;
}

/** Install {@link binding} of {@link definition} into {@link target}, or log the problem. */
function addBinding(
  definition: CommandDefinition,
  binding: CommandBinding,
  target: PartialKeymap,
): void {
  const problem = bindingProblem(definition, binding);
  if (problem !== null) {
    target.problems.push(problem);
    return;
  }
  const byMode = modeMap(target, binding.mode);
  const existing = byMode.get(binding.chord);
  if (existing !== undefined) {
    target.problems.push(
      t('keys.already_bound', {
        command: definition.name,
        chord: binding.chord,
        line: existing.line,
      }),
    );
    return;
  }
  const conflict = conflictingSequence(byMode.keys(), binding.chord);
  if (conflict !== null) {
    target.problems.push(
      t('keys.conflicts', { command: definition.name, chord: binding.chord, other: conflict }),
    );
    return;
  }
  byMode.set(binding.chord, {
    line: commandLine(definition, binding),
    prefill: binding.prefill ?? false,
  });
}

/** Apply {@link override} over the defaults already in {@link target}: replace, add, or delete. */
function applyOverride(override: KeyOverride, target: PartialKeymap): void {
  if (parseSequence(override.chord) !== override.chord) {
    target.problems.push(t('keys.override_invalid_key', { chord: override.chord }));
    return;
  }
  const byMode = modeMap(target, override.mode);
  if (override.line === null) {
    byMode.delete(override.chord);
    return;
  }
  if (override.mode === 'insert' && blocksTyping(override.chord)) {
    target.problems.push(t('keys.override_would_block_typing', { chord: override.chord }));
    return;
  }
  const conflict = conflictingSequence(byMode.keys(), override.chord);
  if (conflict !== null) {
    target.problems.push(t('keys.override_conflicts', { chord: override.chord, other: conflict }));
    return;
  }
  byMode.set(override.chord, { line: override.line, prefill: false });
}

/**
 * Generate the {@link Keymap} from {@link registry} and the reader's
 * {@link overrides}: walk the commands in registry order and install every
 * binding they declare, then lay the overrides over the result.
 */
export function buildKeymap(registry: Registry, overrides: readonly KeyOverride[] = []): Keymap {
  const target: PartialKeymap = { insert: new Map(), navigation: new Map(), problems: [] };
  for (const definition of registry.commands) {
    for (const binding of definition.bindings ?? []) {
      addBinding(definition, binding, target);
    }
  }
  for (const override of overrides) {
    applyOverride(override, target);
  }
  return target;
}
