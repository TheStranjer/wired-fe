/**
 * The windows a session boots into (AGENTS.md "Windows, like IRC buffers"):
 * every restored account's home timeline and its notifications, one pair per
 * account, in opening order — every other account's pair first and the active
 * account's last, because opening a window is what makes it the one the reader
 * is looking at. Startup dispatches these; the titles come from ./homeWindow
 * and ./notificationsWindow, the same rules their commands use.
 */

import { homeWindowOpen } from './homeWindow';
import { notificationsWindowOpen } from './notificationsWindow';
import type { StoredAccount } from '../accounts/accountStore';
import type { WindowsAction } from '../windows/reducer';

/** {@link accounts} in opening order: as given, with the active account moved last. */
function activeAccountLast(
  accounts: readonly StoredAccount[],
  activeKey: string | null,
): readonly StoredAccount[] {
  const others = accounts.filter((account) => account.key !== activeKey);
  const active = accounts.filter((account) => account.key === activeKey);
  return [...others, ...active];
}

/**
 * One home window and one notifications window per account in
 * {@link accounts}, titled against {@link activeKey}, each account's
 * notifications opened right after its home and the active account's pair
 * opened last.
 */
export function openStartupWindows(
  accounts: readonly StoredAccount[],
  activeKey: string | null,
): readonly WindowsAction[] {
  return activeAccountLast(accounts, activeKey).flatMap((account) => [
    homeWindowOpen(account, activeKey),
    notificationsWindowOpen(account, activeKey),
  ]);
}
