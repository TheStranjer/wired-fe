/**
 * What a failed authorization call says to the user (WFE-168). The one
 * refusal with a cause the user can act on — the instance has not marked
 * WiredFE a trusted app, so it may not approve other apps — gets its own
 * explanation; the rest is the shared one-line description. Pure.
 */

import { type ApiError, describeApiError } from '../../api/errors';

/** Shown for a 403 `unauthorized_client`. */
const NOT_TRUSTED =
  'This instance has not marked WiredFE as a trusted app, so it cannot authorize other apps. ' +
  'Ask the instance administrator to mark WiredFE as trusted.';

/** The sentence to show for {@link error}. */
export function describeAuthorizeError(error: ApiError): string {
  if (error.kind === 'http' && error.status === 403 && error.message === 'unauthorized_client') {
    return NOT_TRUSTED;
  }
  if (error.kind === 'http' && error.status === 400) {
    return `The instance refused this authorization request: ${error.message}`;
  }
  return `Could not authorize: ${describeApiError(error)}`;
}
