/**
 * `/notifications` (decision 6, aliases `/n` and `/notifs`): open the active
 * account's notifications as their own window (AGENTS.md "Windows, like IRC
 * buffers"). From there the window is reached like any other — `/win N`,
 * `Alt+N`, a click on the status line — and opening it again only activates
 * the window that already shows it, which is what the window reducer does with
 * an `open` for a view it has. Nothing posts into it (src/features/
 * notifications). Without an account there is no notification list to open, so
 * the command says what to type instead; arguments are ignored, the active
 * account is the only subject.
 */

import { notificationsWindowOpen } from '../../state/notificationsWindow';
import { activeAccount } from '../../state/selectors';
import { NOT_LOGGED_IN, contextRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The notifications window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/** Ask for the active account's notifications window, or report why there is none. */
function handle(context: CommandContext): CommandOutcome {
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  context.dispatchWindows(notificationsWindowOpen(account, context.state.activeAccountKey));
  return OK;
}

/** The `/notifications` definition. */
export const command: CommandDefinition = {
  name: 'notifications',
  aliases: ['n', 'notifs'],
  usage: '/notifications',
  summary: 'Open your notifications',
  run: contextRun(handle),
};
