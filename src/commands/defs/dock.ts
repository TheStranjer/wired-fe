/**
 * `/dock` (decisions 6 and 12): the focused float joins the split tree beside
 * the last pane, keeping its window. Anything else focused says so and
 * changes nothing. The layout reducer does the move.
 */

import { focusedFloat } from '../focusedFloat';
import { OK, contextRun, fail } from '../outcome';
import type { CommandDefinition } from '../types';

/** The refusal when the focused pane is not a float. */
const NOT_A_FLOAT = fail('The focused pane is not a float');

/** The `/dock` definition. */
export const command: CommandDefinition = {
  name: 'dock',
  usage: '/dock',
  summary: 'Dock the focused float into the tiled panes',
  run: contextRun((context) => {
    if (focusedFloat(context) === null) {
      return NOT_A_FLOAT;
    }
    context.dispatch({ type: 'layout', action: { type: 'dock' } });
    return OK;
  }),
};
