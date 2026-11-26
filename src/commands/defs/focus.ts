/**
 * `/focus <left|right|up|down|next|prev>` (decision 12): move focus to the
 * neighbouring pane (`h`, `l`, `k`, `j` also work, as in vim), or cycle through
 * the panes, tree first and then floats, wrapping. At the edge of the desktop
 * nothing happens and nothing is printed. The layout reducer finds the pane;
 * this command only reads the word and hands the step over.
 */

import { t } from '../../i18n/translate';
import { wordsOf } from '../../lib/words';
import type { CommandBinding } from '../bindingTypes';
import { focusStepOf } from '../directionWords';
import { OK, fail, syncRun } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form, all literal words, so it is not translated; a refused argument echoes it. */
const USAGE = '/focus <left|right|up|down|next|prev>';

/**
 * The default bindings (decision 18): `Ctrl+B` then an arrow focuses that way,
 * `o` the next pane; in navigation mode `w` then `h/j/k/l` focuses that way
 * and `w w` the next pane.
 */
const BINDINGS: readonly CommandBinding[] = [
  ...tmuxBindings('ArrowLeft', 'left'),
  ...tmuxBindings('ArrowRight', 'right'),
  ...tmuxBindings('ArrowUp', 'up'),
  ...tmuxBindings('ArrowDown', 'down'),
  ...tmuxBindings('o', 'next'),
  { mode: 'navigation', chord: 'w h', args: 'left' },
  { mode: 'navigation', chord: 'w j', args: 'down' },
  { mode: 'navigation', chord: 'w k', args: 'up' },
  { mode: 'navigation', chord: 'w l', args: 'right' },
  { mode: 'navigation', chord: 'w w', args: 'next' },
];

/** Move focus by the one word of {@link args}; anything else echoes the usage. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, ...rest] = wordsOf(args.toLowerCase());
  const step = word === undefined || rest.length > 0 ? null : focusStepOf(word);
  if (step === null) {
    return fail(t('commands.defs.focus.usage_error', { usage: USAGE }));
  }
  context.dispatch({ type: 'layout', action: { type: 'focusStep', step } });
  return OK;
}

/** The `/focus` definition. */
export const command: CommandDefinition = {
  name: 'focus',
  usage: USAGE,
  get summary(): string {
    return t('commands.defs.focus.summary');
  },
  run: syncRun(handle),
  bindings: BINDINGS,
};
