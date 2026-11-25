/**
 * `/swap <left|right|up|down>` (decision 12): exchange the window of the
 * focused pane with its neighbour's in that direction (`h`, `l`, `k`, `j` also
 * work); focus follows the window. At the edge of the desktop, or from a float,
 * nothing happens and nothing is printed. The layout reducer does the swap;
 * this command only reads the word and hands the direction over.
 */

import { wordsOf } from '../../lib/words';
import { directionOf } from '../directionWords';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form; a refused argument echoes it. */
const USAGE = '/swap <left|right|up|down>';

/** Swap toward the one direction of {@link args}; anything else echoes the usage. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, ...rest] = wordsOf(args.toLowerCase());
  const direction = word === undefined || rest.length > 0 ? null : directionOf(word);
  if (direction === null) {
    return fail(`Usage: ${USAGE}`);
  }
  context.dispatch({ type: 'layout', action: { type: 'swap', direction } });
  return OK;
}

/** The `/swap` definition. */
export const command: CommandDefinition = {
  name: 'swap',
  usage: USAGE,
  summary: 'Swap the focused pane’s window with its neighbour',
  run: syncRun(handle),
};
