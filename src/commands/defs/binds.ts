/**
 * `/binds [insert|navigation]` (decision 6, WFE-130, alias `/keys`): what the
 * keyboard does right now — the registry's default bindings with the reader's
 * own overrides applied (src/keys/keymap), read off the command context as one
 * effective list. Entries print sorted by chord under a header per mode, two
 * spaces, the chord, its command line, and a `(prefill)` tag where the chord
 * fills the command line instead of running it; a mode with nothing bound
 * prints `(none)`. One argument limits the list to that mode.
 */

import { t } from '../../i18n/translate';
import { wordsOf } from '../../lib/words';
import { modeOf } from '../bindingArgs';
import type { BindingMode } from '../bindingTypes';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form: its words are all literal, so it is not translated. */
const USAGE = '/binds [insert|navigation]';

/** Print {@link mode}'s header and its chords sorted by chord; `(none)` when it has none. */
function printMode(context: CommandContext, mode: BindingMode): void {
  context.print(t('commands.defs.binds.mode_header', { mode }));
  const bound = [...context.keys.keymap[mode]].toSorted((a, b) => a[0].localeCompare(b[0]));
  if (bound.length === 0) {
    context.print(`  ${t('commands.defs.binds.none')}`);
    return;
  }
  for (const [chord, entry] of bound) {
    const tag = entry.prefill ? ` ${t('commands.defs.binds.prefill')}` : '';
    context.print(`  ${chord}  ${entry.line}${tag}`);
  }
}

/** Do what one argument text asks: print both modes, or just the one named. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, extra] = wordsOf(args);
  if (extra !== undefined) {
    return fail(t('commands.defs.binds.usage_error', { usage: USAGE }));
  }
  if (word === undefined) {
    printMode(context, 'insert');
    printMode(context, 'navigation');
    return OK;
  }
  const mode = modeOf(word);
  if (mode === null) {
    return fail(t('commands.defs.binds.not_a_mode', { word }));
  }
  printMode(context, mode);
  return OK;
}

/** The `/binds` (alias `/keys`) definition. */
export const command: CommandDefinition = {
  name: 'binds',
  aliases: ['keys'],
  usage: USAGE,
  get summary(): string {
    return t('commands.defs.binds.summary');
  },
  run: syncRun(handle),
};
