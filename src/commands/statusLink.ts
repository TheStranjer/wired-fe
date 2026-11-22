/**
 * Where a post links, for the commands that hand its link on (`/open`,
 * `/copy`): one definition, so both follow the same address.
 */

import type { Status } from '../api/schemas/status';

/** Where {@link status} links: its web page, or its canonical id when it has none. */
export function statusLink(status: Status): string {
  return status.url ?? status.uri;
}
