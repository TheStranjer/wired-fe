/**
 * Opening an account's profile window (AGENTS.md "Windows, like IRC buffers"):
 * the one transition the `/whois` command and every nick click in the
 * scrollback ask for, built here in the pure state layer so commands and
 * views share it without importing each other (AGENTS.md "Layout"). The
 * window's target is the account's id — the key its statuses, relationships
 * and whois lines are fetched by — while the status line and the topic bar
 * show it as `@<acct>`. Opening the same account twice finds the window that
 * already shows it, like every other view (src/windows/reducer).
 */

import type { Account } from '../api/schemas/account';
import type { WindowsAction } from '../windows/reducer';

/** The open variant of the window list's vocabulary, which this builds. */
type OpenAction = Extract<WindowsAction, { readonly type: 'open' }>;

/**
 * The window-list transition that opens the profile window of {@link account},
 * owned by the window-list state {@link accountKey} names (null only when a
 * click happens somewhere no account owns).
 */
export function profileWindowOpen(
  account: Pick<Account, 'id' | 'acct'>,
  accountKey: string | null,
): OpenAction {
  return {
    type: 'open',
    ref: { kind: 'profile', accountKey, target: account.id },
    title: `@${account.acct}`,
  };
}
