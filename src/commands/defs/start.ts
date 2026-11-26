/**
 * `/start` (decision 6, WFE-299): open the start menu, the `[≡ wired]` button
 * at the left of the status line, whose rows open a view as a float. `Ctrl+B
 * Space` in either mode and `w Space` in navigation mode run it.
 */

import { t } from '../../i18n/translate';
import { OK, contextRun } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Open the start menu. */
function handle(context: CommandContext): CommandOutcome {
  context.dispatch({ type: 'startMenu', open: true });
  return OK;
}

/** The `/start` definition. */
export const command: CommandDefinition = {
  name: 'start',
  usage: '/start',
  get summary(): string {
    return t('commands.defs.start.summary');
  },
  run: contextRun(handle),
  bindings: [...tmuxBindings('Space', ''), { mode: 'navigation', chord: 'w Space', args: '' }],
};
