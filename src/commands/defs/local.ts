/**
 * `/local` (decision 6): open the local timeline — this instance's own posts —
 * as its own window (AGENTS.md "Windows, like IRC buffers"). From there the
 * window is reached like any other: `Alt+N`, `/win N`, a click on the status
 * line — and opening it again only activates the window that already shows it,
 * which is what the window reducer does with an `open` for a view it has. Plain
 * text typed into it posts to that account (src/features/local). Without an
 * account there is no session to ask for the timeline, so the command says what
 * to type instead; arguments are ignored, the active account is the only
 * subject.
 */

import { accountWindowOpen } from '../../state/accountWindow';
import { activeAccount } from '../../state/selectors';
import { NOT_LOGGED_IN } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The local window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/** Ask for the active account's local window, or report why there is none. */
function handle(context: CommandContext): CommandOutcome {
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  context.dispatchWindows(accountWindowOpen('local', account, context.state.activeAccountKey));
  return OK;
}

/** The `/local` definition. */
export const command: CommandDefinition = {
  name: 'local',
  aliases: [],
  usage: '/local',
  summary: 'Open the local timeline',
  run: async (_args, context) => await Promise.resolve(handle(context)),
};
