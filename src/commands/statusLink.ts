/**
 * Where a post links, for the commands that hand its link on (`/open`,
 * `/copy`): one definition, so both follow the same address. A post of the
 * acting account's own instance links to WiredFE's permalink for it, never
 * to the backend's `/notice/<id>` page, which is not a web page of its own.
 */

import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { formatRoute } from '../lib/route';

/** The part of the address bar a permalink is built on. */
export type PageLocation = Pick<Location, 'origin' | 'pathname'>;

/** Where {@link status} links: its web page, or its canonical id when it has none. */
export function statusLink(status: Status): string {
  return status.url ?? status.uri;
}

/** Whether {@link status} has a uri or url under {@link account}'s instance origin. */
function isLocal(status: Status, account: StoredAccount): boolean {
  const prefix = `${account.origin}/`;
  return [status.uri, status.url].some((link) => link?.startsWith(prefix) === true);
}

/**
 * WiredFE's own permalink for {@link status} on {@link page} when the post
 * lives on {@link account}'s instance (its uri or url is under that origin,
 * slash included, so a look-alike host never matches); null for any other post
 * or when there is no account.
 */
export function localPermalink(
  status: Status,
  account: StoredAccount | null,
  page: PageLocation,
): string | null {
  return account !== null && isLocal(status, account)
    ? `${page.origin}${page.pathname}${formatRoute({ kind: 'notice', value: status.id })}`
    : null;
}
