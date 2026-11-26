/**
 * Home windows: the transition that opens one account's home timeline
 * (AGENTS.md "Windows, like IRC buffers"). The `/home` command opens it, and
 * so does startup for every restored account — through ./startupWindows, which
 * pairs it with the account's notifications window. It is named here in the
 * pure state layer, next to the rule that titles it — your own home is `home`,
 * another account's is `home/<username>` — which ./accountWindow shares with
 * every other window an account owns.
 */

import { accountWindowOpen } from './accountWindow';
import type { OpenAction } from './placement';
import type { StoredAccount } from '../accounts/accountStore';

/** The window-list transition that opens {@link account}'s home window. */
export function homeWindowOpen(account: StoredAccount, activeKey: string | null): OpenAction {
  return accountWindowOpen('home', account, activeKey);
}
