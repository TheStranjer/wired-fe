/**
 * What a click on a mention or a hashtag in a post's body asks for (WFE-156):
 * the window-list transition that opens it inside the app, owned by the account
 * of the window the post is in — the same windows `/whois` and `/tag` open, so
 * a profile or tag already open is activated rather than opened twice. A mention
 * opens by the id the backend resolved on this window's own instance, so no
 * lookup is needed. The window is placed by the click (WFE-238, decision 13):
 * the configured placement for a plain click, a float for Ctrl or Cmd, a
 * vsplit for Shift, hidden for the middle button.
 */

import type { ContentLink } from './contentLinks';
import type { ClickModifiers } from '../lib/clickModifiers';
import { hashtagWindowOpen } from '../state/hashtagWindow';
import type { PlacementSettings } from '../state/placement';
import { clickOpen } from '../state/placementFromClick';
import { profileWindowOpen } from '../state/profileWindow';
import type { Dispatch } from '../state/StateContext';

/**
 * The click handler of one row: for a href in {@link links} it dispatches the
 * window open on {@link accountKey}, placed as the click and the app's
 * settings say, and answers true; for any other href, or when no account owns the
 * window, it does nothing and answers false so the link keeps its browser
 * behaviour.
 */
export function openContentLink(
  links: ReadonlyMap<string, ContentLink>,
  accountKey: string | null,
  app: { readonly settings: PlacementSettings; readonly go: Dispatch },
): (href: string, click: ClickModifiers) => boolean {
  return (href, click) => {
    const link = links.get(href);
    if (link === undefined || accountKey === null) {
      return false;
    }
    const open =
      link.kind === 'tag'
        ? hashtagWindowOpen(link.name, accountKey)
        : profileWindowOpen({ id: link.accountId, acct: link.acct }, accountKey);
    app.go(clickOpen(app.settings, open, click));
    return true;
  };
}
