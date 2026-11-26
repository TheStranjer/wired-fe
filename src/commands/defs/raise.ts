/**
 * `/raise` (decisions 6 and 12): bring the focused float to the top of the
 * floats. Focusing a float already raises it, so this exists for bindings and
 * the help list. A tiled pane has nothing to raise: that is a quiet no-op.
 * With nothing focused at all the command says so.
 */

import { t } from '../../i18n/translate';
import { activeDesktop } from '../../windows/desktops';
import { focusedFloat } from '../focusedFloat';
import { OK, contextRun, fail } from '../outcome';
import type { CommandDefinition, CommandOutcome } from '../types';

/** The refusal on a desktop with nothing focused. */
function noPane(): CommandOutcome {
  return fail(t('commands.defs.raise.no_pane'));
}

/** The `/raise` definition. */
export const command: CommandDefinition = {
  name: 'raise',
  usage: '/raise',
  get summary(): string {
    return t('commands.defs.raise.summary');
  },
  run: contextRun((context) => {
    const float = focusedFloat(context);
    if (float !== null) {
      context.dispatch({ type: 'layout', action: { type: 'raiseFloat', paneId: float.paneId } });
      return OK;
    }
    return activeDesktop(context.state.layout).focusedPaneId === null ? noPane() : OK;
  }),
};
