/**
 * The one rule for which instance URLs the app may talk to (decision 3):
 * `https:` anywhere, and plain `http:` only on the development machine. The
 * build-time config check and the typed `/connect` input both use it, so the
 * two can never disagree about what the build's CSP was derived for.
 */

/** Hostnames allowed plain `http:` because they are the development machine. */
export const LOCAL_HOSTNAMES: readonly string[] = ['localhost', '127.0.0.1'];

/** True for `https:` anywhere and for `http:` on a {@link LOCAL_HOSTNAMES} host. */
export function isAllowedInstanceUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && LOCAL_HOSTNAMES.includes(url.hostname))
  );
}

/** The instances a visitor may pick from on a `list` build, and whether they may type another. */
export type InstanceChoices = {
  readonly origins: readonly string[];
  readonly allowCustom: boolean;
};

/**
 * How {@link origin} is written when typed or shown: the bare host for an
 * `https:` origin (`wired.example`), the whole origin for a local `http:` one,
 * since a bare host would be read as `https:`. Either form is accepted as typed.
 */
export function instanceWord(origin: string): string {
  const url = new URL(origin);
  return url.protocol === 'https:' ? url.host : url.origin;
}

/** The host (port included) of {@link origin}: `wired.example`, `localhost:4000`. */
export function hostOfOrigin(origin: string): string {
  return new URL(origin).host;
}

/**
 * A permalink's host segment: a dotted host name, or `localhost`, then an
 * optional port. Anything else (`registration`, `notice`, a bare word) is not
 * a host, which keeps the box routes and `#/@user` unambiguous.
 */
const ROUTE_HOST = /^(?:[a-z\d-]+(?:\.[a-z\d-]+)+|localhost)(?::\d{1,5})?$/iu;

/**
 * The origin a permalink's {@link host} segment stands for, by the rule of
 * {@link isAllowedInstanceUrl}: `http:` for a {@link LOCAL_HOSTNAMES} host,
 * `https:` for any other; null when it is no host or its port is out of range.
 */
export function originOfHost(host: string): string | null {
  if (!ROUTE_HOST.test(host)) {
    return null;
  }
  try {
    const scheme = LOCAL_HOSTNAMES.includes(new URL(`http://${host}`).hostname) ? 'http' : 'https';
    return new URL(`${scheme}://${host}`).origin;
  } catch {
    return null;
  }
}
