/**
 * Where a post links, for the commands that hand its link on (`/open`,
 * `/copy`): one definition, so both follow the same address. A post of the
 * acting account's own instance links to WiredFE's permalink for it, never
 * to the backend's `/notice/<id>` page, which is not a web page of its own.
 */

import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { buildConfig } from '../config/config';
import type { InstancesConfig } from '../config/schema';
import { formatRoute } from '../lib/route';

/** Where a permalink is built: the page's address and the build's instance mode (decision 3). */
export type PermalinkPage = Pick<Location, 'origin' | 'pathname'> & {
  readonly mode: InstancesConfig['mode'];
};

/** This page's address and this build's instance mode: what a command links against. */
export function currentPage(): PermalinkPage {
  const { origin, pathname } = window.location;
  return { origin, pathname, mode: buildConfig.instances.mode };
}

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
 * or when there is no account. A `list` or `open` build may sign in to many
 * instances, so its link names the instance (`#/<host>/notice/<id>`); a
 * `same-origin` or `fixed` build has only one and keeps the short form.
 */
export function localPermalink(
  status: Status,
  account: StoredAccount | null,
  page: PermalinkPage,
): string | null {
  if (account === null || !isLocal(status, account)) {
    return null;
  }
  const qualified = page.mode === 'list' || page.mode === 'open';
  const origin = qualified ? { origin: account.origin } : {};
  return `${page.origin}${page.pathname}${formatRoute({ kind: 'notice', value: status.id, ...origin })}`;
}
