/**
 * The windows one account owns (AGENTS.md "Windows, like IRC buffers"): the
 * transition that opens an account's view of a window kind and the title the
 * status line lists it with. Home, local and federated windows differ only in
 * which kind they show, so the naming rule lives here in the pure state layer —
 * the lowest one the command layer and the app share; a window kind is a
 * feature, and commands may not import features (AGENTS.md "Layout"). Your own
 * window is titled with its kind, `home` or `local`; another account's takes
 * the username the way `dm/bob` names a second buffer (src/ui/StatusLine.tsx).
 */

import type { StoredAccount } from '../accounts/accountStore';
import type { WindowKind, WindowRef } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** The plain username part of {@link handle}: `lain` for `lain@wired.example`. */
function usernameOf(handle: string): string {
  const [username = handle] = handle.split('@');
  return username;
}

/** The view of {@link kind} that {@link account} owns, with nothing to target. */
function accountWindowRef(kind: WindowKind, account: StoredAccount): WindowRef {
  return { kind, accountKey: account.key, target: null };
}

/** The title of {@link account}'s {@link kind} window: plain while it is the active account's own. */
function accountWindowTitle(
  kind: WindowKind,
  account: StoredAccount,
  activeKey: string | null,
): string {
  return account.key === activeKey ? kind : `${kind}/${usernameOf(account.handle)}`;
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
): WindowsAction {
  return {
    type: 'open',
    ref: accountWindowRef(kind, account),
    title: accountWindowTitle(kind, account, activeKey),
  };
}
