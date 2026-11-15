/**
 * The keymap (decision 6): one hotkey map per mode (AGENTS.md "Two hotkey
 * modes"), generated from the default bindings declared across the command
 * registry. Chords are canonical strings (see ./chord) and every entry names
 * the command line the chord carries — to run, or to fill into the command
 * line when the binding is a prefill — so a hotkey and the typed command are
 * one path.
 *
 * A binding that cannot work is reported in `problems` (for the status
 * window) instead of installed: a chord that is not canonical, one that would
 * swallow typing in insert mode, or one an earlier command already took. The
 * first binding of a chord wins, in registry order.
 */

import { parseChord } from './chord';
import type { CommandBinding, CommandDefinition, Registry } from '../commands/types';

/** One keymap entry: a chord's command line, run or filled into the input. */
type KeymapEntry = {
  /** The command line the chord carries, e.g. `/win 3` or `/reply {label}`. */
  readonly line: string;
  /** True fills the line into the command line (a prefill binding), false runs it. */
  readonly prefill: boolean;
};

/** The two hotkey maps and what went wrong building them. */
export type Keymap = {
  /** Chord -> entry while typing in the command line, e.g. `Alt+3` -> `/win 3`. */
  readonly insert: ReadonlyMap<string, KeymapEntry>;
  /** Chord -> entry while navigating. */
  readonly navigation: ReadonlyMap<string, KeymapEntry>;
  /** Human-readable reasons a binding was refused, in registry order. */
  readonly problems: readonly string[];
};

/** The keymap under construction: the finished shape with mutable collections. */
type PartialKeymap = {
  readonly insert: Map<string, KeymapEntry>;
  readonly navigation: Map<string, KeymapEntry>;
  readonly problems: string[];
};

/** The `Shift+` a canonical chord may carry in front of its key. */
const SHIFT_PREFIX = 'Shift+';

/** The command line {@link binding} of {@link definition} runs. */
function commandLine(definition: CommandDefinition, binding: CommandBinding): string {
  return binding.args === '' ? `/${definition.name}` : `/${definition.name} ${binding.args}`;
}

/**
 * The key of a canonical chord with a leading Shift set aside. Printable keys
 * are single characters and named keys are not, and a canonical chord
 * carrying Ctrl, Alt or Meta always keeps one of their `+` joiners and a
 * length above one here, so a one-letter result is exactly a plain printable
 * character or `Shift+<letter>`.
 */
function plainKeyOf(chord: string): string {
  return chord.startsWith(SHIFT_PREFIX) ? chord.slice(SHIFT_PREFIX.length) : chord;
}

/** Why {@link binding} cannot be installed, or null when it can. */
function bindingProblem(definition: CommandDefinition, binding: CommandBinding): string | null {
  if (parseChord(binding.chord) !== binding.chord) {
    return `/${definition.name}: invalid key ${binding.chord}`;
  }
  if (binding.mode === 'insert' && plainKeyOf(binding.chord).length === 1) {
    return `/${definition.name}: ${binding.chord} would block typing in insert mode`;
  }
  return null;
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
  const byMode = binding.mode === 'insert' ? target.insert : target.navigation;
  const existing = byMode.get(binding.chord);
  if (existing !== undefined) {
    target.problems.push(`/${definition.name}: ${binding.chord} already bound to ${existing.line}`);
    return;
  }
  byMode.set(binding.chord, {
    line: commandLine(definition, binding),
    prefill: binding.prefill ?? false,
  });
}

/**
 * Generate the {@link Keymap} from {@link registry}: walk the commands in
 * registry order and install every binding they declare.
 */
export function buildKeymap(registry: Registry): Keymap {
  const target: PartialKeymap = { insert: new Map(), navigation: new Map(), problems: [] };
  for (const definition of registry.commands) {
    for (const binding of definition.bindings ?? []) {
      addBinding(definition, binding, target);
    }
  }
  return target;
}
