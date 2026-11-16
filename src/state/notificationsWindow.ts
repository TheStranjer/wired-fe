/**
 * Notifications windows: the transition that opens one account's notifications
 * (AGENTS.md "Windows, like IRC buffers"). Both the `/notifications` command
 * and startup open them, so they are named here in the pure state layer, next
 * to the rule that titles them — your own is `notifs`, another account's is
 * `notifs/<username>` — the short name the window is typed and listed with,
 * which ./accountWindow titles the way it titles every other account window.
 */

import { accountWindowRef, accountWindowTitle } from './accountWindow';
import type { StoredAccount } from '../accounts/accountStore';
import type { WindowsAction } from '../windows/reducer';

/** The label every account's notifications window is titled from. */
const NOTIFS_LABEL = 'notifs';

/**
 * The window-list transition that opens {@link account}'s notifications
 * window, titled against {@link activeKey}: opening the view twice finds the
 * window that already shows it, as every account window does.
 */
export function notificationsWindowOpen(
  account: StoredAccount,
  activeKey: string | null,
): WindowsAction {
  return {
    type: 'open',
    ref: accountWindowRef('notifications', account),
    title: accountWindowTitle(NOTIFS_LABEL, account, activeKey),
  };
}
