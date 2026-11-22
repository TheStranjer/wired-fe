/**
 * The account's full handle for display and for the account store
 * (decision 8): what `verify_credentials` reports is normalized here into
 * one `user@host` form, so a stored account always carries the handle a
 * command can refer to it by. Pure: the account fields and the instance
 * origin arrive as parameters.
 */

import type { Account } from '../api/schemas/account';

/**
 * `"user@host"` for an account seen from `origin`: the account's fqn if
 * set, else acct when it has an "@", else acct + "@" + origin hostname.
 */
export function fullHandle(account: Pick<Account, 'acct' | 'fqn'>, origin: string): string {
  if (account.fqn !== null) {
    return account.fqn;
  }
  if (account.acct.includes('@')) {
    return account.acct;
  }
  return `${account.acct}@${new URL(origin).hostname}`;
}

/** The part of {@link handle} before its first `@`: `lain` for `lain@wired.example`. */
export function usernameOf(handle: string): string {
  const [username = handle] = handle.split('@');
  return username;
}
