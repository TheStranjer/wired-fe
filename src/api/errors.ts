/**
 * The error type every API call returns inside `Result<T, ApiError>`, and its
 * human-readable description for status-window messages. One variant per way
 * a request can fail; callers switch on `kind`.
 */

import { formatClock } from '../lib/time';

/** Why an API call failed. */
export type ApiError =
  | { readonly kind: 'network'; readonly message: string }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'http'; readonly status: number; readonly message: string }
  | { readonly kind: 'rate-limited'; readonly resetAt: Date | null }
  | { readonly kind: 'parse'; readonly message: string };

/** Renders an {@link ApiError} as the one-line message shown in the status window. */
export function describeApiError(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return `Network error: ${error.message}`;
    case 'aborted':
      return 'Request cancelled';
    case 'http':
      return `HTTP ${String(error.status)}: ${error.message}`;
    case 'rate-limited':
      return error.resetAt === null
        ? 'Rate limited'
        : `Rate limited until ${formatClock(error.resetAt, '24h')}`;
    case 'parse':
      return `Unexpected response: ${error.message}`;
  }
}
