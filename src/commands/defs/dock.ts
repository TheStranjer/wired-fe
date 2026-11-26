/**
 * `/dock` (decisions 6 and 12): the focused float joins the split tree beside
 * the last pane, keeping its window. Anything else focused says so and
 * changes nothing. The layout reducer does the move.
 */

import { t } from '../../i18n/translate';
import { focusedFloat } from '../focusedFloat';
import { OK, contextRun, fail } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandDefinition, CommandOutcome } from '../types';

/** The refusal when the focused pane is not a float. */
function notAFloat(): CommandOutcome {
  return fail(t('commands.defs.dock.not_a_float'));
}

/** The `/dock` definition. */
export const command: CommandDefinition = {
  name: 'dock',
  usage: '/dock',
  get summary(): string {
    return t('commands.defs.dock.summary');
  },
  bindings: [...tmuxBindings('d', ''), { mode: 'navigation', chord: 'w d', args: '' }],
  run: contextRun((context) => {
    if (focusedFloat(context) === null) {
      return notAFloat();
    }
    context.dispatch({ type: 'layout', action: { type: 'dock' } });
    return OK;
  }),
};
