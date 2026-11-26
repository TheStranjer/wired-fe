/**
 * What an external-login box shows once the instance has answered (WFE-169):
 * an address it may send the browser to (only http(s), see lib/webUrl; the
 * browser is sent through the `navigate` callback), a wait for a further step,
 * or why nothing happened. An answer that points anywhere else is refused
 * rather than followed. Pure apart from the navigation it is handed.
 */

import type { ExternalRegistration } from '../../api/endpoints/external';
import { type ApiError, describeApiError } from '../../api/errors';
import type { MessageKey } from '../../i18n/messages';
import { t } from '../../i18n/translate';
import { webUrl } from '../../lib/webUrl';

/** A line the box ends on: it went through, or it did not. */
export type Settled = {
  readonly kind: 'finished' | 'error';
  readonly message: string;
};

/** The message an account that still needs a step before it works says, by reason. */
const WAITING: Readonly<Record<'confirmation' | 'approval', MessageKey>> = {
  confirmation: 'features.external.waiting_confirmation',
  approval: 'features.external.waiting_approval',
};

/** Navigate through {@link navigate} to {@link uri} when it is an http(s) address, and say what the box shows next. */
export function settleRedirect(uri: string, navigate: (url: string) => void): Settled {
  const target = webUrl(uri);
  if (target === null) {
    return { kind: 'error', message: t('features.external.unsafe_redirect') };
  }
  navigate(target);
  return { kind: 'finished', message: t('features.external.continuing') };
}

/** What the box shows for the instance's answer {@link registration}. */
export function settleRegistration(
  registration: ExternalRegistration,
  navigate: (url: string) => void,
): Settled {
  if (registration.kind === 'redirect') {
    return settleRedirect(registration.uri, navigate);
  }
  return { kind: 'finished', message: t(WAITING[registration.reason]) };
}

/** The sentence for {@link error}: the instance's own message for a refusal (a 422's `error`), else the shared description. */
export function describeExternalError(error: ApiError): string {
  return error.kind === 'http' ? error.message : describeApiError(error);
}
