/**
 * The startup step that turns a path route into a hash route (decision 4):
 * when wired-be sends the browser to `/notice/<id>` or `/<nickname>` on this
 * origin, {@link routeFromPath} rewrites the address bar to the matching
 * `/#/...` with the page's own replace, so the hash router (./useHashRoute)
 * finds the route where it looks and a reload never repeats the path. A path
 * that is not one of those leaves the address bar alone.
 */

import { type PathLocation, pathToHash } from '../lib/pathRoute';

/** The address bar as this step sees it: {@link PathLocation} and how to rewrite it. */
type RouteLocation = PathLocation & {
  /** Rewrites the address bar without a reload (real one: `history.replaceState(null, '', path)`). */
  readonly replaceUrl: (path: string) => void;
};

/** Replace the path in {@link location} with its hash route, if it has one. */
export function routeFromPath(location: RouteLocation): void {
  const hash = pathToHash(location);
  if (hash !== null) {
    location.replaceUrl(`/${hash}`);
  }
}
