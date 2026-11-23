/**
 * The `#/oauth/authorize?<query>` route (decision 4, WFE-168): wired-be sends a
 * third-party app's authorization request to `/oauth/authorize?...` on this
 * origin, startup turns the path into this hash (`pathToHash`), and the
 * authorization box reads the request out of it. Pure: nothing here reads the
 * address bar.
 */

/** The authorization route: its keyword, then a non-empty query. */
const AUTHORIZE = /^#\/oauth\/authorize\?(.+)$/u;

/**
 * The query parameters of the `#/oauth/authorize?...` route {@link hash}
 * spells (`window.location.hash`), or null when it is some other hash or
 * carries no parameters. A repeated parameter keeps its last value.
 */
export function parseAuthorizeRoute(hash: string): Readonly<Record<string, string>> | null {
  const [, query] = AUTHORIZE.exec(hash) ?? [];
  if (query === undefined) {
    return null;
  }
  const params = Object.fromEntries(new URLSearchParams(query));
  return Object.keys(params).length === 0 ? null : params;
}
