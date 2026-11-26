/**
 * The error type every API call returns inside `Result<T, ApiError>`, and its
 * human-readable description for status-window messages. One variant per way
 * a request can fail; callers switch on `kind`.
 */

import { activeLocale } from '../i18n/activeLocale';
import { formatClock } from '../i18n/format';
import { t } from '../i18n/translate';

/** Per-field validation messages of a refused request, keyed by field name. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/** Why an API call failed. */
export type ApiError =
  | { readonly kind: 'network'; readonly message: string }
  | { readonly kind: 'aborted' }
  | {
      readonly kind: 'http';
      readonly status: number;
      readonly message: string;
      /** The response's `details` (Mastodon's 422 field errors), when it had usable ones. */
      readonly details?: FieldErrors;
    }
  | { readonly kind: 'rate-limited'; readonly resetAt: Date | null }
  | { readonly kind: 'parse'; readonly message: string };

/** Renders an {@link ApiError} as the one-line message shown in the status window. */
export function describeApiError(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return t('api.network_error', { message: error.message });
    case 'aborted':
      return t('api.request_cancelled');
    case 'http':
      return t('api.http_error', { status: String(error.status), message: error.message });
    case 'rate-limited':
      return error.resetAt === null
        ? t('api.rate_limited')
        : t('api.rate_limited_until', {
            time: formatClock(activeLocale(), error.resetAt, '24h'),
          });
    case 'parse':
      return t('api.unexpected_response', { message: error.message });
  }
}
