/**
 * `/more` (decision 6, alias `/older`): ask the active window for the page of
 * posts older than the ones its scrollback already shows. The ask is one
 * reducer action and nothing else — the window's own loader turns it into a
 * fetch (see src/views/useTimeline), so paging stays reachable from the
 * command line, a hotkey and the mouse over the top of the buffer alike
 * (AGENTS.md "Everything is reachable three ways"). A window that has already
 * seen the end of its history prints that instead of asking for more;
 * arguments are ignored, the active window is the only target.
 */

import { bufferFor } from '../../state/selectors';
import { activeWindow } from '../../windows/model';
import type { CommandBinding, CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command ran; what it asked for is on its way to the reducer. */
const OK: CommandOutcome = { ok: true };

/** What a window at the end of its history answers with. */
const NO_OLDER = 'No older posts';

/** The navigation-mode key (AGENTS.md "Two hotkey modes"): read further back. */
const BINDINGS: readonly CommandBinding[] = [{ mode: 'navigation', chord: 'm', args: '' }];

/** Ask the active window's buffer for one more older page, or report the end. */
function handle(context: CommandContext): CommandOutcome {
  const windowId = activeWindow(context.windows).id;
  if (bufferFor(context.state, windowId).exhausted) {
    context.print(NO_OLDER);
    return OK;
  }
  context.dispatch({ type: 'requestOlder', windowId });
  return OK;
}

/** The `/more` (alias `/older`) definition. */
export const command: CommandDefinition = {
  name: 'more',
  aliases: ['older'],
  usage: '/more',
  summary: 'Load the next page of older posts',
  run: async (_args, context) => await Promise.resolve(handle(context)),
  bindings: BINDINGS,
};
