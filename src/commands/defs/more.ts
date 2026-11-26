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

import { t } from '../../i18n/translate';
import { bufferFor } from '../../state/selectors';
import { activeWindow } from '../../windows/model';
import type { CommandBinding } from '../bindingTypes';
import { OK, contextRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The navigation-mode key (AGENTS.md "Two hotkey modes"): read further back. */
const BINDINGS: readonly CommandBinding[] = [{ mode: 'navigation', chord: 'm', args: '' }];

/** Ask the active window's buffer for one more older page, or report the end. */
function handle(context: CommandContext): CommandOutcome {
  const windowId = activeWindow(context.windows).id;
  if (bufferFor(context.state, windowId).exhausted) {
    context.print(t('commands.defs.more.no_older'));
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
  get summary(): string {
    return t('commands.defs.more.summary');
  },
  run: contextRun(handle),
  bindings: BINDINGS,
};
