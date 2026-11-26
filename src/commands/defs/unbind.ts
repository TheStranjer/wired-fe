/**
 * `/unbind <insert|navigation> <chord>` (decision 6, WFE-130): take one chord
 * out of one mode's map, straight from the command line. The mode word and the
 * chord — every word after the mode, so a sequence such as `w v` works
 * (decision 18) — are read exactly as `/bind` reads them — text naming no bindable key
 * answers `Not a key: <chord>`. An override the reader made for that mode and
 * chord is simply dropped, putting the command's default binding back; where
 * there was no override, one with a null line is added, so a default binding
 * unbound stays unbound over every rebuild. Either way the new list rides out
 * in a `settings` action and the command prints `<mode> <chord> unbound`.
 */

import { t } from '../../i18n/translate';
import { wordsOf } from '../../lib/words';
import { modeOf, storeRebind } from '../bindingArgs';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form. */
function usage(): string {
  return t('commands.defs.unbind.usage');
}

/** Do what one argument text asks, or echo the usage back. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [modeWord, ...chordWords] = wordsOf(args);
  const mode = modeOf(modeWord);
  const chordText = chordWords.join(' ');
  if (mode === null || chordText === '') {
    return fail(t('commands.defs.unbind.usage_error', { usage: usage() }));
  }
  const chord = context.keys.parseChord(chordText);
  if (chord === null) {
    return fail(t('commands.defs.unbind.not_a_key', { chord: chordText }));
  }
  storeRebind(context, { mode, chord, line: null });
  context.print(t('commands.defs.unbind.unbound', { mode, chord }));
  return OK;
}

/** The `/unbind` definition. */
export const command: CommandDefinition = {
  name: 'unbind',
  get usage(): string {
    return usage();
  },
  get summary(): string {
    return t('commands.defs.unbind.summary');
  },
  run: syncRun(handle),
};
