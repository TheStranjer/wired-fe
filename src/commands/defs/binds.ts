/**
 * `/binds [insert|navigation]` (decision 6, WFE-130, alias `/keys`): what the
 * keyboard does right now — the registry's default bindings with the reader's
 * own overrides applied (src/keys/keymap), read off the command context as one
 * effective list. Entries print sorted by chord under a header per mode, two
 * spaces, the chord, its command line, and a `(prefill)` tag where the chord
 * fills the command line instead of running it; a mode with nothing bound
 * prints `(none)`. One argument limits the list to that mode.
 */

import { wordsOf } from '../../lib/words';
import { modeOf } from '../bindingArgs';
import { OK, fail, syncRun } from '../outcome';
import type { BindingMode, CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form. */
const USAGE = '/binds [insert|navigation]';

/** Print {@link mode}'s header and its chords sorted by chord; `(none)` when it has none. */
function printMode(context: CommandContext, mode: BindingMode): void {
  context.print(`Keys (${mode} mode):`);
  const bound = [...context.keys.keymap[mode]].toSorted((a, b) => a[0].localeCompare(b[0]));
  if (bound.length === 0) {
    context.print('  (none)');
    return;
  }
  for (const [chord, entry] of bound) {
    const tag = entry.prefill ? ' (prefill)' : '';
    context.print(`  ${chord}  ${entry.line}${tag}`);
  }
}

/** Do what one argument text asks: print both modes, or just the one named. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, extra] = wordsOf(args);
  if (extra !== undefined) {
    return fail(`Usage: ${USAGE}`);
  }
  if (word === undefined) {
    printMode(context, 'insert');
    printMode(context, 'navigation');
    return OK;
  }
  const mode = modeOf(word);
  if (mode === null) {
    return fail(`Not a mode: ${word}. Try /binds`);
  }
  printMode(context, mode);
  return OK;
}

/** The `/binds` (alias `/keys`) definition. */
export const command: CommandDefinition = {
  name: 'binds',
  aliases: ['keys'],
  usage: USAGE,
  summary: 'Show the effective key bindings',
  run: syncRun(handle),
};
