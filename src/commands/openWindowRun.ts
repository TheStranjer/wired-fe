/**
 * The run the account-window commands share (decision 6): `/home`, `/local`,
 * `/federated` and `/notifications` all open a window of the active account, or
 * refuse when nobody is signed in. Each says only which window it opens.
 */

import { NOT_LOGGED_IN, contextRun } from './outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import { activeAccount } from '../state/selectors';
import type { WindowsAction } from '../windows/reducer';

/** The window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/**
 * A command's run that dispatches {@link open}'s transition for the active
 * account, titled against the active account key, and refuses with the
 * not-logged-in message when there is no account. Arguments are ignored.
 */
export function accountWindowRun(
  open: (account: StoredAccount, activeKey: string | null) => WindowsAction,
): CommandDefinition['run'] {
  return contextRun((context: CommandContext) => {
    const account = activeAccount(context.state);
    if (account === null) {
      return NOT_LOGGED_IN;
    }
    context.dispatchWindows(open(account, context.state.activeAccountKey));
    return OK;
  });
}
