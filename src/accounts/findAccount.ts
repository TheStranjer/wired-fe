/**
 * The account a command argument names (decision 8, decision 6): `/account
 * switch` and `/as` take a short query, and this module resolves it against
 * the stored account list — a 1-based position in the list, the full handle
 * with or without its leading `@` (any case), or a username prefix exactly one
 * account answers to. An index outranks a prefix a username could also start
 * with; an empty query, no match and an ambiguous prefix all answer `null`,
 * leaving the refusal's wording to the caller. Pure: the list arrives as a
 * parameter, so nothing here reads the store.
 */

import type { StoredAccount } from './accountStore';
import { usernameOf } from './handle';

/** A query that could be a 1-based position in the list: digits only. */
const INDEX_QUERY = /^\d+$/u;

/** The account at the 1-based position {@link term} numbers, or null. */
function accountAtIndex(accounts: readonly StoredAccount[], term: string): StoredAccount | null {
  if (!INDEX_QUERY.test(term)) {
    return null;
  }
  const indexed = accounts[Number(term) - 1];
  return indexed ?? null;
}

/** The account whose whole handle is {@link term} (already lowercase). */
function accountByHandle(
  accounts: readonly StoredAccount[],
  term: string,
): StoredAccount | undefined {
  return accounts.find((account) => account.handle.toLowerCase() === term);
}

/** The only account whose username starts with {@link term}; null when none or several do. */
function accountByPrefix(accounts: readonly StoredAccount[], term: string): StoredAccount | null {
  const prefixed = accounts.filter((account) => usernameOf(account.handle).startsWith(term));
  const only = prefixed.length === 1 ? prefixed[0] : undefined;
  return only ?? null;
}

/**
 * The account of {@link accounts} that {@link query} names: its 1-based
 * position, its full handle, or a username prefix unique to it. Surrounding
 * space and one leading `@` are ignored, and matching ignores case; nothing
 * matched, or the prefix is ambiguous, answers `null`.
 */
export function findAccount(
  accounts: readonly StoredAccount[],
  query: string,
): StoredAccount | null {
  const term = query.trim().replace(/^@/u, '').toLowerCase();
  if (term === '') {
    return null;
  }
  const indexed = accountAtIndex(accounts, term);
  if (indexed !== null) {
    return indexed;
  }
  return accountByHandle(accounts, term) ?? accountByPrefix(accounts, term);
}
