/**
 * The `#/oauth/external/register` and `#/oauth/external/consent` routes
 * (decision 4, WFE-169): after an external login (a sign-in with another
 * provider) wired-be sends the browser to `/oauth/external/register?state=` to
 * finish a new account, or to `/oauth/external/consent?state=&confirm_token=`
 * to approve an app; startup turns the path into the hash (`pathToHash`) and
 * the overlay reads what it needs out of it. Pure: nothing here reads the
 * address bar.
 */

/** What an external-login route asks the page to do. */
export type ExternalRoute =
  | { readonly kind: 'register'; readonly state: string }
  | { readonly kind: 'consent'; readonly state: string; readonly confirmToken: string };

/** An external-login route: its keyword, then an optional query. */
const EXTERNAL = /^#\/oauth\/external\/(register|consent)(?:\?(.*))?$/u;

/**
 * The route {@link hash} (`window.location.hash`) spells, or null when it is
 * some other hash. A missing `state` or `confirm_token` is kept as the empty
 * string: the instance refuses it, and the box shows why.
 */
export function parseExternalRoute(hash: string): ExternalRoute | null {
  const [, kind, query = ''] = EXTERNAL.exec(hash) ?? [];
  if (kind === undefined) {
    return null;
  }
  const params = new URLSearchParams(query);
  const state = params.get('state') ?? '';
  return kind === 'register'
    ? { kind, state }
    : { kind: 'consent', state, confirmToken: params.get('confirm_token') ?? '' };
}
