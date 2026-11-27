/**
 * Which signed-in account opens a hash route (decision 4). An unqualified
 * route is the active account's. A qualified one (`#/<host>/notice/<id>`)
 * names the instance its id belongs to: the active account when it is on that
 * origin, otherwise the first signed-in account on it, in store order;
 * nobody when no account is on that origin.
 */

import type { StoredAccount } from '../../accounts/accountStore';
import { type Route, routeOrigin } from '../../lib/route';

/** The account that opens {@link route}, or null when there is none. */
export function routeAccount(
  route: Route,
  active: StoredAccount | null,
  accounts: readonly StoredAccount[],
): StoredAccount | null {
  const origin = routeOrigin(route);
  if (origin === undefined) {
    return active;
  }
  return [active, ...accounts].find((account) => account?.origin === origin) ?? null;
}
