/**
 * Home windows: the transitions that open one account's home timeline, and the
 * title the status line lists it with (AGENTS.md "Windows, like IRC buffers").
 * Both the `/home` command and startup open them, so the rule lives here in the
 * pure state layer — the lowest one the command layer and the app share; a
 * window kind is a feature, and commands may not import features (AGENTS.md
 * "Layout"). Your own home is `home`; another account's is `home/<username>`,
 * the way `dm/bob` names a second buffer (src/ui/StatusLine.tsx).
 */

import type { StoredAccount } from '../accounts/accountStore';
import type { WindowRef } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** What the active account's own home window is called; another's takes a suffix. */
const HOME_TITLE = 'home';

/** The plain username part of {@link handle}: `lain` for `lain@wired.example`. */
function usernameOf(handle: string): string {
  const [username = handle] = handle.split('@');
  return username;
}

/** The view {@link account} owns: its home timeline, with nothing to target. */
function homeWindowRef(account: StoredAccount): WindowRef {
  return { kind: 'home', accountKey: account.key, target: null };
}

/** The title of {@link account}'s home window: plain while it is the active account's own. */
function homeWindowTitle(account: StoredAccount, activeKey: string | null): string {
  return account.key === activeKey ? HOME_TITLE : `${HOME_TITLE}/${usernameOf(account.handle)}`;
}

/** The window-list transition that opens {@link account}'s home window. */
export function homeWindowOpen(account: StoredAccount, activeKey: string | null): WindowsAction {
  return { type: 'open', ref: homeWindowRef(account), title: homeWindowTitle(account, activeKey) };
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
