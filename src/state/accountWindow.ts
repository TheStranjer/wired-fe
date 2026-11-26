/**
 * The windows one account owns (AGENTS.md "Windows, like IRC buffers"): the
 * transition that opens an account's view of a window kind and the title the
 * status line lists it with. Home, local, federated and notifications windows
 * differ in which kind they show and what they are titled with — `notifs`,
 * not `notifications` (src/state/notificationsWindow) — so the naming rule
 * lives here in the pure state layer, the lowest one the command layer and the
 * app share; a window kind is a feature, and commands may not import features
 * (AGENTS.md "Layout"). Your own window is titled plain, `home` or `local`;
 * another account's takes the username the way `dm/bob` names a second buffer
 * (src/ui/StatusLine.tsx).
 */

import type { OpenAction } from './placement';
import type { StoredAccount } from '../accounts/accountStore';
import { usernameOf } from '../accounts/handle';
import type { WindowKind, WindowRef } from '../windows/model';

/** The view of {@link kind} that {@link account} owns, with nothing to target. */
export function accountWindowRef(kind: WindowKind, account: StoredAccount): WindowRef {
  return { kind, accountKey: account.key, target: null };
}

/**
 * The title of {@link account}'s window shown under {@link label}: plain while
 * it is the active account's own, `label/<username>` for another's.
 */
export function accountWindowTitle(
  label: string,
  account: StoredAccount,
  activeKey: string | null,
): string {
  return account.key === activeKey ? label : `${label}/${usernameOf(account.handle)}`;
}

/**
 * The window-list transition that opens {@link account}'s window of
 * {@link kind}, titled against {@link activeKey}: opening a view twice finds
 * the window that already shows it, which is what the reducer does with an
 * `open` for a ref it has.
 */
export function accountWindowOpen(
  kind: WindowKind,
  account: StoredAccount,
  activeKey: string | null,
): OpenAction {
  return {
    type: 'open',
    ref: accountWindowRef(kind, account),
    title: accountWindowTitle(kind, account, activeKey),
  };
}
