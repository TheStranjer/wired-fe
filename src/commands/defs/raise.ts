/**
 * `/raise` (decisions 6 and 12): bring the focused float to the top of the
 * floats. Focusing a float already raises it, so this exists for bindings and
 * the help list. A tiled pane has nothing to raise: that is a quiet no-op.
 * With nothing focused at all the command says so.
 */

import { activeDesktop } from '../../windows/desktops';
import { focusedFloat } from '../focusedFloat';
import { OK, contextRun, fail } from '../outcome';
import type { CommandDefinition } from '../types';

/** The refusal on a desktop with nothing focused. */
const NO_PANE = fail('There is no pane to raise on this desktop');

/** The `/raise` definition. */
export const command: CommandDefinition = {
  name: 'raise',
  usage: '/raise',
  summary: 'Bring the focused float to the top',
  run: contextRun((context) => {
    const float = focusedFloat(context);
    if (float !== null) {
      context.dispatch({ type: 'layout', action: { type: 'raiseFloat', paneId: float.paneId } });
      return OK;
    }
    return activeDesktop(context.state.layout).focusedPaneId === null ? NO_PANE : OK;
  }),
};
