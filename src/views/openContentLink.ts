/**
 * What a click on a mention or a hashtag in a post's body asks for (WFE-156):
 * the window-list transition that opens it inside the app, owned by the account
 * of the window the post is in — the same windows `/whois` and `/tag` open, so
 * a profile or tag already open is activated rather than opened twice. A mention
 * opens by the id the backend resolved on this window's own instance, so no
 * lookup is needed.
 */

import type { ContentLink } from './contentLinks';
import { hashtagWindowOpen } from '../state/hashtagWindow';
import { profileWindowOpen } from '../state/profileWindow';
import type { Dispatch } from '../state/StateContext';

/**
 * The click handler of one row: for a href in {@link links} it dispatches the
 * window open on {@link accountKey} and answers true; for any other href, or
 * when no account owns the window, it does nothing and answers false so the
 * link keeps its browser behaviour.
 */
export function openContentLink(
  links: ReadonlyMap<string, ContentLink>,
  accountKey: string | null,
  go: Dispatch,
): (href: string) => boolean {
  return (href) => {
    const link = links.get(href);
    if (link === undefined || accountKey === null) {
      return false;
    }
    go({
      type: 'windows',
      action:
        link.kind === 'tag'
          ? hashtagWindowOpen(link.name, accountKey)
          : profileWindowOpen({ id: link.accountId, acct: link.acct }, accountKey),
    });
    return true;
  };
}
