/**
 * OAuth plumbing for login (decision 8): the redirect URI registered with the
 * instance, derived from the page's location, and the parser for the query
 * string the browser comes back with. Pure: the location and the query arrive
 * as parameters, so there is no `window` access to test around.
 */

/** A present, non-empty query parameter value. */
function isPresent(value: string | null): value is string {
  return value !== null && value !== '';
}

/**
 * The redirect URI to register with the instance and to send with the
 * authorization request: the page's origin plus pathname, with no query and
 * no hash (decision 4 keeps routing in the hash, so it never reaches the
 * server).
 */
export function redirectUriFor(location: {
  readonly origin: string;
  readonly pathname: string;
}): string {
  return `${location.origin}${location.pathname}`;
}

/**
 * The result of an OAuth callback: either the `code` and `state` to exchange,
 * or the `error` the server reported with its optional description and the
 * `state` it echoed (absent when the redirect did not carry one).
 */
export type Callback =
  | { readonly kind: 'code'; readonly code: string; readonly state: string }
  | {
      readonly kind: 'error';
      readonly error: string;
      readonly description: string | null;
      readonly state: string | null;
    };

/**
 * Reads an OAuth callback out of a location's query string (`?code=...&state=...`
 * or `?error=...&error_description=...`). Returns `null` for anything that is
 * not a callback, including a lone `code` without its `state`.
 */
export function parseCallback(search: string): Callback | null {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state');
  if (isPresent(code) && isPresent(state)) {
    return { kind: 'code', code, state };
  }
  const error = params.get('error');
  if (isPresent(error)) {
    const description = params.get('error_description');
    return {
      kind: 'error',
      error,
      description: isPresent(description) ? description : null,
      state: isPresent(state) ? state : null,
    };
  }
  return null;
}
