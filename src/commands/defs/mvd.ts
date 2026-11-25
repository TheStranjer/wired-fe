/**
 * `/mvd <number> [follow]` (decision 6; decisions 12 and 18): move the focused
 * pane or float to desktop `number`, creating it when it does not exist. The
 * view stays on the current desktop, focused on its next pane; `follow`
 * switches to the target desktop too. The layout reducer performs the move;
 * this command only finds the pane and hands the actions over.
 */

import { wordsOf } from '../../lib/words';
import { activeDesktop } from '../../windows/desktops';
import { desktopNumber } from '../desktopNumber';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form. */
const USAGE = '/mvd <number> [follow]';

/** The argument text matched the form in no way. */
const USAGE_ERROR = fail(`Usage: ${USAGE}`);

/** The refusal: an empty desktop has nothing to move. */
const NOTHING_FOCUSED = fail('No pane to move');

/** Move the focused pane to desktop {@link n}, then show it there when {@link follow}. */
function move(context: CommandContext, n: number, follow: boolean): CommandOutcome {
  const { layout } = context.state;
  const { focusedPaneId } = activeDesktop(layout);
  if (focusedPaneId === null) {
    return NOTHING_FOCUSED;
  }
  if (n === layout.active + 1) {
    return fail(`Already on desktop ${String(n)}`);
  }
  context.dispatch({
    type: 'layout',
    action: { type: 'movePaneToDesktop', paneId: focusedPaneId, n },
  });
  if (follow) {
    context.dispatch({ type: 'layout', action: { type: 'goToDesktop', n } });
  }
  return OK;
}

/** Read the argument words and move. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, second, extra] = wordsOf(args);
  const n = desktopNumber(word, USAGE_ERROR);
  if (typeof n !== 'number') {
    return n;
  }
  if (extra !== undefined || (second !== undefined && second !== 'follow')) {
    return USAGE_ERROR;
  }
  return move(context, n, second === 'follow');
}

/** The `/mvd` definition. */
export const command: CommandDefinition = {
  name: 'mvd',
  usage: USAGE,
  summary: 'Move the focused pane to another desktop',
  run: syncRun(handle),
};
