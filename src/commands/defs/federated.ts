/**
 * `/federated` (decision 6, alias `/fed`): open the federated timeline — what
 * the instance talks to the rest of the fediverse about — as its own window
 * (AGENTS.md "Windows, like IRC buffers"). From there the window is reached like
 * any other: `Alt+N`, `/win N`, a click on the status line — and opening it
 * again only activates the window that already shows it, which is what the
 * window reducer does with an `open` for a view it has. Plain text typed into it
 * posts to that account (src/features/federated). Without an account there is no
 * session to ask for the timeline, so the command says what to type instead;
 * arguments are ignored, the active account is the only subject.
 */

import { accountWindowOpen } from '../../state/accountWindow';
import { activeAccount } from '../../state/selectors';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The federated window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/** Shown when nobody is signed in: there is no session to ask for a timeline. */
const NOT_LOGGED_IN: CommandOutcome = {
  ok: false,
  message: 'Not logged in. Type /connect',
};

/** Ask for the active account's federated window, or report why there is none. */
function handle(context: CommandContext): CommandOutcome {
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  context.dispatchWindows(accountWindowOpen('federated', account, context.state.activeAccountKey));
  return OK;
}

/** The `/federated` definition. */
export const command: CommandDefinition = {
  name: 'federated',
  aliases: ['fed'],
  usage: '/federated',
  summary: 'Open the federated timeline',
  run: async (_args, context) => await Promise.resolve(handle(context)),
};
