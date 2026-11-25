/**
 * `pathToHash` (decision 4): wired-be redirects browsers to path routes on
 * the frontend's origin (`/notice/<id>`, `/<nickname>`, `/users/<nickname>`,
 * `/authorize_interaction?uri=`, `/registration/<token>`,
 * `/password_reset/<token>`, `/oauth/authorize?...`, `/oauth/external/register`
 * and `/oauth/external/consent`), while WiredFE only routes by hash. This maps
 * each of those pathnames onto the hash route that means the same thing, so
 * the startup step can swap one for the other in the address bar. The first
 * three become the routes of ./route; the rest keep their path and query as a
 * hash (`#/registration/<token>`): the invite route opens the sign-up box
 * (`parseRegistrationRoute`), the reset letter's route the new-password box
 * (`parsePasswordResetRoute`), the authorization request
 * `#/oauth/authorize?...` opens the app-authorization box
 * (`parseAuthorizeRoute`), the others have no window, so nothing acts on
 * them but nothing is lost either. Pure.
 */

/** The part of the address bar the conversion reads. */
export type PathLocation = {
  /** The path, as `window.location.pathname`. */
  readonly pathname: string;
  /** The query string, as `window.location.search`. */
  readonly search: string;
};

/** The paths with no window, whose path and query are kept as a hash. */
const KEPT = /^\/(?:authorize_interaction|(?:registration|password_reset|oauth)\/.+)$/u;

/**
 * `/notice/<id>` (the notice group), `/users/<nickname>` or `/<nickname>`,
 * with an optional `@`; never the page itself or a keyword alone.
 */
const PATH = /^\/(?:(notice)\/|users\/)?(?!(?:@|index\.html|notice|users)$)@?([^/]+)$/u;

/**
 * {@link pathname} relative to the hosting path {@link basePath} (ending in
 * `/`), as an absolute path (`/fe/notice/a` under `/fe/` is `/notice/a`; the
 * bare `/fe` is `/`), or null when the path lies outside the base.
 */
function underBase(pathname: string, basePath: string): string | null {
  if (pathname === basePath.slice(0, -1)) {
    return '/';
  }
  return pathname.startsWith(basePath) ? pathname.slice(basePath.length - 1) : null;
}

/**
 * The hash route (leading `#` included) that {@link location}'s path stands
 * for, or null when the path is not one of wired-be's redirect targets: the
 * page's own root, `index.html`, an asset, or anything unknown. The bundle may
 * be hosted under {@link basePath} (the build's `basePath`, `/` by default):
 * it is stripped before matching, so `/fe/notice/a` under `/fe/` is the
 * notice route and `/fe/` itself is the page.
 */
export function pathToHash(location: PathLocation, basePath = '/'): string | null {
  const { search } = location;
  const pathname = underBase(location.pathname, basePath);
  if (pathname === null) {
    return null;
  }
  if (KEPT.test(pathname)) {
    return `#${pathname}${search}`;
  }
  const [, notice, name] = PATH.exec(pathname) ?? [];
  if (name === undefined) {
    return null;
  }
  return notice === undefined ? `#/@${name.replaceAll('%40', '@')}` : `#/notice/${name}`;
}
