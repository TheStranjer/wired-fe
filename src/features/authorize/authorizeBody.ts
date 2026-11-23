/**
 * The decision the user made, as the JSON body wired-be wants (WFE-168): the
 * request that arrived in the address bar says what was asked for, the app
 * info says what the instance understood by it, and `approve` says what the
 * user answered. Pure.
 */

import type { AuthorizeBody, AuthorizeInfo } from '../../api/endpoints/authorize';

/** The optional parameters of the body: the state and the PKCE pair, each left out when absent or empty. */
function optionalParts(
  query: Readonly<Record<string, string>>,
  info: AuthorizeInfo,
): Pick<AuthorizeBody, 'state' | 'code_challenge' | 'code_challenge_method'> {
  const state = query['state'] ?? info.state ?? '';
  const challenge = query['code_challenge'] ?? '';
  const method = query['code_challenge_method'] ?? '';
  return {
    ...(state === '' ? {} : { state }),
    ...(challenge === '' ? {} : { code_challenge: challenge }),
    ...(method === '' ? {} : { code_challenge_method: method }),
  };
}

/**
 * The body for {@link approve}: the client and redirect URI of {@link query}
 * (the instance's own reading of the URI when the query lacks one), the scope
 * asked for (else the scopes the instance listed), and the optional state and
 * PKCE parameters the query carried.
 */
export function authorizeBody(
  query: Readonly<Record<string, string>>,
  info: AuthorizeInfo,
  approve: boolean,
): AuthorizeBody {
  return {
    client_id: query['client_id'] ?? '',
    redirect_uri: query['redirect_uri'] ?? info.redirectUri,
    scope: query['scope'] ?? info.scopes.join(' '),
    ...optionalParts(query, info),
    approve,
  };
}
