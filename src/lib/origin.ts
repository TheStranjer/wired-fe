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
