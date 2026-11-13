/**
 * `/clear` (decision 6): empty the scrollback of the active window, the way
 * WeeChat clears a buffer. Ctrl+L does it in both hotkey modes, like any
 * terminal. Arguments are ignored: the active window is the only target.
 */

import type { CommandDefinition, CommandOutcome } from '../types';

/** /clear cannot fail: an already empty window clears just the same. */
const OK: CommandOutcome = { ok: true };

/** The `/clear` (alias `/cl`) definition. */
export const command: CommandDefinition = {
  name: 'clear',
  aliases: ['cl'],
  usage: '/clear',
  summary: 'Clear the active window',
  run: async (_args, context) => {
    context.clearActiveWindow();
    return await Promise.resolve(OK);
  },
  bindings: [
    { mode: 'insert', chord: 'Ctrl+l', args: '' },
    { mode: 'navigation', chord: 'Ctrl+l', args: '' },
  ],
};
