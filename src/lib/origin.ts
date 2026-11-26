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
