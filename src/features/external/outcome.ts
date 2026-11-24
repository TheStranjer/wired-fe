/**
 * What an external-login box shows once the instance has answered (WFE-169):
 * an address it may send the browser to (only http(s), see lib/webUrl; the
 * browser is sent through the `navigate` callback), a wait for a further step,
 * or why nothing happened. An answer that points anywhere else is refused
 * rather than followed. Pure apart from the navigation it is handed.
 */

import type { ExternalRegistration } from '../../api/endpoints/external';
import { type ApiError, describeApiError } from '../../api/errors';
import { webUrl } from '../../lib/webUrl';

/** A line the box ends on: it went through, or it did not. */
export type Settled = {
  readonly kind: 'finished' | 'error';
  readonly message: string;
};

/** Shown when the answer's redirect address is not one the browser may be sent to. */
const REFUSED =
  'The instance answered with a redirect address that is not safe to follow. Nothing was sent.';

/** What an account that still needs a step before it works says, by reason. */
const WAITING: Readonly<Record<'confirmation' | 'approval', string>> = {
  confirmation: 'Account created. Check your email to confirm your address, then log in.',
  approval: 'Account created. It is awaiting approval by a moderator.',
};

/** Navigate through {@link navigate} to {@link uri} when it is an http(s) address, and say what the box shows next. */
export function settleRedirect(uri: string, navigate: (url: string) => void): Settled {
  const target = webUrl(uri);
  if (target === null) {
    return { kind: 'error', message: REFUSED };
  }
  navigate(target);
  return { kind: 'finished', message: 'Continuing…' };
}

/** What the box shows for the instance's answer {@link registration}. */
export function settleRegistration(
  registration: ExternalRegistration,
  navigate: (url: string) => void,
): Settled {
  if (registration.kind === 'redirect') {
    return settleRedirect(registration.uri, navigate);
  }
  return { kind: 'finished', message: WAITING[registration.reason] };
}

/** The sentence for {@link error}: the instance's own message for a refusal (a 422's `error`), else the shared description. */
export function describeExternalError(error: ApiError): string {
  return error.kind === 'http' ? error.message : describeApiError(error);
}
