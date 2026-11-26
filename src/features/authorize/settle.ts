/**
 * What the box shows once the instance has answered a decision (WFE-168): a
 * URL it may send the browser to (only http(s), see ./redirectTarget), a code
 * to show, or nothing more to do. An answer that points anywhere else is
 * refused rather than followed.
 */

import { redirectTarget } from './redirectTarget';
import type { AuthorizeDecision } from '../../api/endpoints/authorize';
import { t } from '../../i18n/translate';

/** What the box shows after a decision. */
export type Settled =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'finished'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

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
    return { kind: 'error', message: t('features.authorize.unsafe_redirect') };
  }
  if (target.kind === 'oob') {
    return { kind: 'finished', message: t('features.authorize.done') };
  }
  navigate(target.url);
  return { kind: 'finished', message: t('features.authorize.returning') };
}
