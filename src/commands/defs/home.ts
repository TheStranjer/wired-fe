/**
 * `/home` (decision 6): open the active account's home timeline as its own
 * window (AGENTS.md "Windows, like IRC buffers"). From there the window is
 * reached like any other — `Alt+N`, `/win N`, a click on the status line — and
 * opening it again only activates the window that already shows it, which is
 * what the window reducer does with an `open` for a view it has. Plain text
 * typed into it posts to that account (src/features/home). Without an account
 * there is no timeline to open, so the command says what to type instead;
 * arguments are ignored, the active account is the only subject.
 */

import { homeWindowOpen } from '../../state/homeWindow';
import { activeAccount } from '../../state/selectors';
import { NOT_LOGGED_IN, contextRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The home window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/** Ask for the active account's home window, or report why there is none. */
function handle(context: CommandContext): CommandOutcome {
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  context.dispatchWindows(homeWindowOpen(account, context.state.activeAccountKey));
  return OK;
}

/** The `/home` definition. */
export const command: CommandDefinition = {
  name: 'home',
  aliases: [],
  usage: '/home',
  summary: 'Open your home timeline',
  run: contextRun(handle),
};
