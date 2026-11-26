/**
 * What a failed authorization call says to the user (WFE-168). The one
 * refusal with a cause the user can act on — the instance has not marked
 * WiredFE a trusted app, so it may not approve other apps — gets its own
 * explanation; the rest is the shared one-line description. Pure.
 */

import { type ApiError, describeApiError } from '../../api/errors';
import { t } from '../../i18n/translate';

/** The sentence to show for {@link error}. */
export function describeAuthorizeError(error: ApiError): string {
  if (error.kind === 'http' && error.status === 403 && error.message === 'unauthorized_client') {
    return t('features.authorize.not_trusted');
  }
  if (error.kind === 'http' && error.status === 400) {
    return t('features.authorize.refused', { message: error.message });
  }
  return t('features.authorize.failed', { reason: describeApiError(error) });
}
