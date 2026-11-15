/**
 * Home windows: the transitions that open one account's home timeline (AGENTS.md
 * "Windows, like IRC buffers"). Both the `/home` command and startup open them,
 * so they are named here in the pure state layer, next to the rule that titles
 * them — your own home is `home`, another account's is `home/<username>` — which
 * ./accountWindow shares with every other window an account owns.
 */

import { accountWindowOpen } from './accountWindow';
import type { StoredAccount } from '../accounts/accountStore';
import type { WindowsAction } from '../windows/reducer';

/** The window-list transition that opens {@link account}'s home window. */
export function homeWindowOpen(account: StoredAccount, activeKey: string | null): WindowsAction {
  return accountWindowOpen('home', account, activeKey);
}

/**
 * One home window per account in {@link accounts}, each titled against
 * {@link activeKey}, in opening order: every other account's first and the
 * active account's last, because opening a window is what makes it the one the
 * reader is looking at.
 */
export function openHomeWindows(
  accounts: readonly StoredAccount[],
  activeKey: string | null,
): readonly WindowsAction[] {
  const others = accounts.filter((account) => account.key !== activeKey);
  const active = accounts.find((account) => account.key === activeKey);
  const ordered = active === undefined ? others : [...others, active];
  return ordered.map((account) => homeWindowOpen(account, activeKey));
}
