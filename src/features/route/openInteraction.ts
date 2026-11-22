/**
 * Finding what a remote follow or interaction link points at (decision 4):
 * another server sent the browser here with `#/authorize_interaction?uri=<v>`,
 * where `<v>` is an account handle or the URL of a post. {@link findInteraction}
 * asks the account's instance to resolve it (`resolve=true`, one result) and
 * answers the first account, else the first post, else undefined for nothing.
 * A failed search finds nothing either. ./openRoute opens the window for it.
 */

import { search } from '../../api/endpoints/search';
import type { Account } from '../../api/schemas/account';
import type { Status } from '../../api/schemas/status';
import type { ApiSession } from '../../api/session';

/** The account or post {@link value} names on {@link session}'s instance, if any. */
export async function findInteraction(
  session: ApiSession,
  value: string,
): Promise<Account | Status | undefined> {
  const found = await search(session, value, { resolve: true, limit: 1 });
  return found.ok ? (found.value.accounts[0] ?? found.value.statuses[0]) : undefined;
}
