/**
 * The links in a post's body that WiredFE opens itself (WFE-156): a mention
 * opens the mentioned account's profile window and a hashtag opens that tag's
 * timeline window, instead of leaving for the backend's own pages (for Wired,
 * a feed route and a redirect to a frontend page this app does not have). The
 * status entity carries what is needed — `mentions[]` and `tags[]` — so this
 * pure module maps the href each one is written as in the body onto what it
 * opens.
 */

import type { Status } from '../api/schemas/status';

/** What a link in a post's body opens in the app. */
export type ContentLink =
  | { readonly kind: 'profile'; readonly accountId: string; readonly acct: string }
  | { readonly kind: 'tag'; readonly name: string };

/** Every link {@link status} carries, by the href it is written as in the body.
 * A tag is keyed by its own url and, under that url's origin (its first three
 * `/`-separated parts: `https:`, nothing, the host), the `/tags/` and `/tag/`
 * spellings with the lowercase name. */
export function contentLinks(status: Status): ReadonlyMap<string, ContentLink> {
  const links = new Map<string, ContentLink>();
  for (const { id, acct, url } of status.mentions) {
    links.set(url, { kind: 'profile', accountId: id, acct });
  }
  for (const { name, url } of status.tags) {
    const lower = name.toLowerCase();
    const origin = url.split('/', 3).join('/');
    for (const href of [url, `${origin}/tags/${lower}`, `${origin}/tag/${lower}`]) {
      links.set(href, { kind: 'tag', name: lower });
    }
  }
  return links;
}
