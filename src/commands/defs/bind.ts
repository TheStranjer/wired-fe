/**
 * `/bind <insert|navigation> <chord> <command line>` (decision 6, WFE-130,
 * AGENTS.md "Every binding is rebindable"): the reader's own key, straight
 * from the command line. The mode must name one of the two hotkey modes and
 * the chord — one chord or a sequence such as `w v` (decision 18), the words
 * before the first one starting with `/` — goes through the context's `parseChord` — text that names no
 * bindable key answers `Not a key: <chord>` — and the line must start with
 * `/`, because that is what a hotkey carries. An insert-mode binding may not
 * swallow typing: the very rule the keymap applies (src/keys/chord), checked
 * before anything is stored. The accepted override replaces any the reader
 * made for that mode and chord, rides out in a `settings` action (and
 * ./useSettingsPersistence keeps it), and prints back `<mode> <chord> →
 * <line>`.
 */

import { wordsOf } from '../../lib/words';
import { modeOf, splitBinding, storeRebind } from '../bindingArgs';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form. */
const USAGE = '/bind <insert|navigation> <chord> <command line>';

/** Do what one argument text asks, or refuse it naming the reason it cannot work. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [modeWord, ...rest] = wordsOf(args);
  const mode = modeOf(modeWord);
  const { chords, line } = splitBinding(rest);
  if (mode === null || chords === '' || line === '') {
    return fail(`Usage: ${USAGE}`);
  }
  const chord = context.keys.parseChord(chords);
  if (chord === null) {
    return fail(`Not a key: ${chords}`);
  }
  if (!line.startsWith('/')) {
    return fail('The command line must start with /');
  }
  if (mode === 'insert' && context.keys.blocksTyping(chord)) {
    return fail(`${chord} would block typing in insert mode`);
  }
  storeRebind(context, { mode, chord, line });
  context.print(`${mode} ${chord} → ${line}`);
  return OK;
}

/** The `/bind` definition. */
export const command: CommandDefinition = {
  name: 'bind',
  usage: USAGE,
  summary: 'Bind a key to a command line',
  run: syncRun(handle),
};
