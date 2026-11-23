/**
 * What the box shows once the instance has answered a decision (WFE-168): a
 * URL it may send the browser to (only http(s), see ./redirectTarget), a code
 * to show, or nothing more to do. An answer that points anywhere else is
 * refused rather than followed.
 */

import { redirectTarget } from './redirectTarget';
import type { AuthorizeDecision } from '../../api/endpoints/authorize';

/** What the box shows after a decision. */
export type Settled =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'finished'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

/** Shown when the answer's redirect address is not one the browser may be sent to. */
const REFUSED =
  'The instance answered with a redirect address that is not safe to follow. Nothing was sent.';

/**
 * Act on {@link decision}: navigate through {@link navigate} for an http(s)
 * redirect, and say what the box shows next. An out-of-band redirect with no
 * code (a denial) has nowhere to go, and anything else is refused.
 */
export function settle(decision: AuthorizeDecision, navigate: (url: string) => void): Settled {
  if (decision.kind === 'code') {
    return { kind: 'code', code: decision.code };
  }
  const target = redirectTarget(decision.uri);
  if (target === null) {
    return { kind: 'error', message: REFUSED };
  }
  if (target.kind === 'oob') {
    return { kind: 'finished', message: 'Done. You can close this box.' };
  }
  navigate(target.url);
  return { kind: 'finished', message: 'Returning to the app…' };
}
