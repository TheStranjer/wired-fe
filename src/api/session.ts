/**
 * The API session: the one origin and bearer token every endpoint call needs.
 * Endpoint functions take an {@link ApiSession} instead of threading origin and
 * token separately, and forward their requests through
 * {@link sessionRequest}, the only place that re-joins the two with
 * `apiRequest` (./http).
 */
import type { ApiError } from './errors';
import { type RequestOptions, apiRequest } from './http';
import type { ApiResponse } from './response';
import type { Result } from '../lib/result';

/** An account's connection to one instance: its origin and bearer token. */
export type ApiSession = {
  /** The instance origin, e.g. `https://wired.example`. */
  readonly origin: string;
  /** The account's token, or null for an anonymous session. */
  readonly token: string | null;
};

/**
 * Sends {@link options} to the session's instance with the session's token.
 * A null token omits the `token` option entirely, so the request carries no
 * `Authorization` header. Everything else is passed through unchanged; the
 * outcome is the one `apiRequest` produces.
 */
export async function sessionRequest<T>(
  session: ApiSession,
  options: Omit<RequestOptions<T>, 'origin' | 'token'>,
): Promise<Result<ApiResponse<T>, ApiError>> {
  return apiRequest({
    ...options,
    origin: session.origin,
    ...(session.token === null ? {} : { token: session.token }),
  });
}
