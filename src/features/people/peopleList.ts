/**
 * What the people window lists (WFE-133, moved here from the old side pane):
 * the heading a watched window's kind earns, and the buffer's participants as
 * list entries named the way the scrollback names them from the watched
 * window's own account. Pure, so it is tested without a DOM.
 */

import type { StoredAccount } from '../../accounts/accountStore';
import { fullHandle } from '../../accounts/handle';
import type { Buffer } from '../../state/buffer';
import type { ListedAccount } from '../../ui/NickList';
import { participants } from '../../views/participants';
import type { WindowKind } from '../../windows/model';

/** One participant, as ../views/participants hands it over; this layer names
 * no api type beyond what the views hand it, so the type is taken from the function. */
type Author = ReturnType<typeof participants>[number];

/** How many nicks the window lists at most. */
const PEOPLE_LIMIT = 50;

/** The list's heading for a watched window kind; null leaves the list empty. */
export const PEOPLE_TITLES: Record<WindowKind, string | null> = {
  status: null,
  home: 'recently here',
  local: 'recently here',
  federated: 'recently here',
  hashtag: 'recently here',
  profile: 'recently here',
  notifications: null,
  search: null,
  thread: 'in thread',
  dm: 'in conversation',
  composer: null,
  feed: null,
  feedEditor: null,
  people: null,
  media: null,
};

/** The account's full handle as the window's account grounds it; alone if none. */
function handleOf(account: Author, viewer: StoredAccount | null): string {
  return viewer === null ? (account.fqn ?? account.acct) : fullHandle(account, viewer.origin);
}

/** One participant as the list shows it: named, and flagged when it is me. */
function listed(account: Author, viewer: StoredAccount | null): ListedAccount {
  return {
    id: account.id,
    acct: account.acct,
    fullHandle: `@${handleOf(account, viewer)}`,
    self: viewer !== null && account.id === viewer.accountId,
  };
}

/** The participants of {@link buffer} as list entries, grounded by {@link viewer}. */
export function listedPeople(
  buffer: Buffer,
  viewer: StoredAccount | null,
): readonly ListedAccount[] {
  return participants(buffer, PEOPLE_LIMIT).map((account) => listed(account, viewer));
}
