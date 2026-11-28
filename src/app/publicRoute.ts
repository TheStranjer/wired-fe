/**
 * Opening a hash route with nobody to open it (decision 4, WFE-340): a visitor
 * with no signed-in account (for a qualified route, none on its origin) may
 * still read a public link. {@link publicOrigin} picks the one instance the
 * link may be read from, by instance mode; {@link openPublicRoute} reads what
 * that instance published about anonymous reads (decision 5, detected without
 * a token), asks {@link decidePublicView} with the build's `publicView` setting
 * (decision 3) and, when the answer is yes, opens the route's window under the
 * signed-out key of that origin (src/state/anonAccount). An account by name
 * (`#/@nick`, where wired-be's `/users/<nickname>` and `/<nickname>` land)
 * qualifies only when its handle is that instance's own (WFE-342). Deciding before the
 * fetch assumes the post or account is local, since the id came from that
 * instance's link; the backend still enforces its own rules for remote objects,
 * and a 401 or 403 later closes the window (./useAnonFallback). A `false`
 * answer opens nothing, and the caller falls back to the `/connect` hint.
 */

import { type DetectDeps, detectProfile } from './startupDetect';
import type { InstanceProfile } from '../capabilities/detect';
import { type AnonymousReadArea, decidePublicView } from '../capabilities/publicView';
import { publicViewSetting } from '../config/publicView';
import type { PublicViewConfig } from '../config/publicView';
import type { InstancesConfig } from '../config/schema';
import { openRoute } from '../features/route/openRoute';
import { openPublicAcct, openPublicUser } from '../features/route/publicUser';
import { hostOfOrigin } from '../lib/origin';
import type { PublicViewSetting } from '../lib/publicViewSetting';
import { type Route, routeOrigin } from '../lib/route';
import { anonKey } from '../state/anonAccount';

/** The part of the build configuration the signed-out route reads. */
export type PublicConfig = {
  readonly instances: InstancesConfig;
  readonly publicView?: PublicViewConfig | undefined;
};

/** What {@link openPublicRoute} needs besides the route. */
export type PublicDeps = DetectDeps & {
  readonly config: PublicConfig;
  /** The page's own origin: the one instance of a `same-origin` build. */
  readonly here: string;
  /** What is already detected, by origin: those are not detected, or reported, again. */
  readonly profiles: ReadonlyMap<string, InstanceProfile>;
};

/**
 * Whether {@link handle} names an account of the instance at {@link host}: a
 * bare nickname, or one whose host part is {@link host} (any case). With no
 * host given, only a bare nickname is.
 */
function isLocalHandle(handle: string, host: string | undefined): boolean {
  const name = handle.startsWith('@') ? handle.slice(1) : handle;
  const at = name.indexOf('@');
  return at === -1 || name.slice(at + 1).toLowerCase() === host?.toLowerCase();
}

/**
 * Which kind of read a signed-out visitor needs for {@link route}; null for a
 * route this never opens. An account by name is read as a profile only when
 * its handle is local to the instance at {@link host} (WFE-342): a bare
 * nickname, or `nick@<host>`; a remote handle is never opened signed out.
 */
export function routeArea(route: Route, host?: string): AnonymousReadArea | null {
  switch (route.kind) {
    case 'notice':
      return 'posts';
    case 'user':
      return 'profiles';
    case 'tag':
      return 'tags';
    case 'acct':
      return isLocalHandle(route.value, host) ? 'profiles' : null;
    case 'interact':
      return null;
  }
}

/** The instance a signed-out visitor may read from by instance mode; null when the mode names none. */
function candidate(
  instances: InstancesConfig,
  here: string,
  named: string | undefined,
): string | null {
  switch (instances.mode) {
    case 'same-origin':
      return here;
    case 'fixed':
      return instances.origin;
    case 'list':
      return named !== undefined && instances.origins.includes(named) ? named : null;
    case 'open':
      return null;
  }
}

/**
 * The origin {@link route} may be read from with no account, or null for none:
 * the page's own in a `same-origin` build, `instances.origin` in a `fixed` one,
 * the route's own origin when a `list` build names it, nothing for an `open`
 * build, an unqualified route in a `list` build or a host that is not listed. A
 * qualified route that names another instance than the one the build serves is
 * not that instance's post, so it is read from none; nor is an account handle
 * whose host is not that instance's.
 */
export function publicOrigin(
  route: Route,
  instances: InstancesConfig,
  here: string,
): string | null {
  const named = routeOrigin(route);
  const found = candidate(instances, here, named);
  if (found === null || (named !== undefined && named !== found)) {
    return null;
  }
  return routeArea(route, hostOfOrigin(found)) === null ? null : found;
}

/** Where and how a route may be read with no account: the instance, the build's setting for it, the kind of read. */
export type PublicCandidate = {
  readonly origin: string;
  readonly setting: PublicViewSetting;
  readonly area: AnonymousReadArea;
};

/**
 * The instance, setting and kind of read {@link route} may be opened with, or
 * null when it may not: no instance by {@link publicOrigin}, or the build turns
 * public view off for it. Nothing is asked of the network here, so the caller
 * can fall back to the hint at once.
 */
export function publicCandidate(
  route: Route,
  config: PublicConfig,
  here: string,
): PublicCandidate | null {
  const origin = publicOrigin(route, config.instances, here);
  const area = origin === null ? null : routeArea(route, hostOfOrigin(origin));
  if (area === null || origin === null) {
    return null;
  }
  const setting = publicViewSetting(config, origin);
  return setting === 'off' ? null : { origin, setting, area };
}

/** What the instance turned out to be, detected now unless it already is; null when it cannot be read. */
async function profileOf(deps: PublicDeps, origin: string): Promise<InstanceProfile | null> {
  return deps.profiles.get(origin) ?? (await detectProfile(deps, origin));
}

/**
 * Open the window of {@link route}, already allowed, under the signed-out key
 * of {@link found}'s origin: an account by id or by name through its lookup,
 * anything else through `openRoute`. The answer is {@link openPublicRoute}'s.
 */
async function openAllowed(
  route: Route,
  found: { readonly origin: string; readonly conflict: boolean },
  dispatch: PublicDeps['dispatch'],
): Promise<boolean> {
  if (route.kind === 'user') {
    return await openPublicUser(route, found, dispatch);
  }
  if (route.kind === 'acct') {
    return await openPublicAcct(route, found, dispatch);
  }
  const { origin } = found;
  await openRoute(route, {
    accountKey: anonKey(origin),
    session: { origin, token: null },
    dispatch,
  });
  return true;
}

/**
 * Open {@link route} for a visitor with no account, when the build and the
 * instance let a signed-out visitor read it. True when the route was taken
 * (its window is open, or a failed lookup said why); false when the caller
 * should fall back to the hint and keep the hash.
 */
export async function openPublicRoute(route: Route, deps: PublicDeps): Promise<boolean> {
  const wanted = publicCandidate(route, deps.config, deps.here);
  const profile = wanted === null ? null : await profileOf(deps, wanted.origin);
  if (wanted === null || profile === null) {
    return false;
  }
  const { origin, setting, area } = wanted;
  const decision = decidePublicView(setting, profile.capabilities.anonymousReads, {
    area,
    locality: 'local',
  });
  if (!decision.allowed) {
    return false;
  }
  return await openAllowed(route, { origin, conflict: decision.conflict }, deps.dispatch);
}
