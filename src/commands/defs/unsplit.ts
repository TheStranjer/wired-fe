/**
 * `/unsplit` (decision 6, decision 12): close the focused pane or float. The
 * window it showed stays open as a hidden buffer, still listed in the status
 * line and still counting unread — unlike `/close`, which closes the window
 * and every pane showing it. Closing the last pane leaves the desktop empty.
 */

import { t } from '../../i18n/translate';
import { activeDesktop } from '../../windows/desktops';
import { OK, contextRun, fail } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandDefinition, CommandOutcome } from '../types';

/** The refusal on a desktop with nothing focused. */
function noPane(): CommandOutcome {
  return fail(t('commands.defs.unsplit.no_pane'));
}

/** The `/unsplit` (alias `/pclose`) definition. */
export const command: CommandDefinition = {
  name: 'unsplit',
  aliases: ['pclose'],
  usage: '/unsplit',
  get summary(): string {
    return t('commands.defs.unsplit.summary');
  },
  bindings: [...tmuxBindings('x', ''), { mode: 'navigation', chord: 'w c', args: '' }],
  run: contextRun((context) => {
    const { layout } = context.state;
    if (activeDesktop(layout).focusedPaneId === null) {
      return noPane();
    }
    context.dispatch({ type: 'layout', action: { type: 'closePane' } });
    return OK;
  }),
};
