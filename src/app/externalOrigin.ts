/**
 * The instance an external-login route is for (WFE-169): these flows need no
 * signed-in account, so it is the build's own instance (`same-origin`,
 * `fixed`), else the active account's, else the page's origin, which is where
 * wired-be sent the browser from.
 */

import { requestOrigin } from './authorizeLogin';
import type { AccountStore } from '../accounts/accountStore';
import type { InstancesConfig } from '../config/schema';

/** The origin the boxes talk to for a route that arrived at {@link pageOrigin}. */
export function externalOrigin(
  accounts: AccountStore,
  instances: InstancesConfig,
  pageOrigin: string,
): string {
  return requestOrigin(accounts, instances) ?? pageOrigin;
}
