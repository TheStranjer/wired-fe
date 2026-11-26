/**
 * `/close` (decision 6): close the active window, IRC-buffer style. Window 1
 * is the status buffer: the session always needs somewhere to print client
 * messages, so closing it is refused, not attempted. Arguments are ignored:
 * the active window is the only target.
 */

import { t } from '../../i18n/translate';
import { STATUS_WINDOW_ID, activeWindow } from '../../windows/model';
import type { CommandDefinition, CommandOutcome } from '../types';

/** Closing a window that is not the status one always succeeds. */
const OK: CommandOutcome = { ok: true };

/** The refusal: every session keeps its window 1. */
function cannotCloseStatus(): CommandOutcome {
  return { ok: false, message: t('commands.defs.close.cannot_close_status') };
}

/** The `/close` (alias `/part`) definition. */
export const command: CommandDefinition = {
  name: 'close',
  aliases: ['part'],
  usage: '/close',
  get summary(): string {
    return t('commands.defs.close.summary');
  },
  run: async (_args, context) => {
    const { id } = activeWindow(context.windows);
    if (id === STATUS_WINDOW_ID) {
      return await Promise.resolve(cannotCloseStatus());
    }
    context.dispatchWindows({ type: 'close', id });
    return await Promise.resolve(OK);
  },
  bindings: [{ mode: 'navigation', chord: 'Shift+q', args: '' }],
};
