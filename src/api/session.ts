/**
 * The API session: the one origin and bearer token every endpoint call needs.
 * Endpoint functions take an {@link ApiSession} instead of threading origin and
 * token separately, and forward their requests through
 * {@link sessionRequest} — or, when they do not page, {@link sessionRequestData},
 * or, for lists, {@link sessionRequestPage} — the only places that re-join the
 * two with `apiRequest` (./http).
 */
import type { ApiError } from './errors';
import { type RequestOptions, apiRequest, requestData } from './http';
import { type Page, toPage } from './page';
import type { ApiResponse } from './response';
import { type Result, ok } from '../lib/result';

/** An account's connection to one instance: its origin and bearer token. */
export type ApiSession = {
  /** The instance origin, e.g. `https://wired.example`. */
  readonly origin: string;
  /** The account's token, or null for an anonymous session. */
  readonly token: string | null;
};

/** What an endpoint passes in: the request options minus what the session supplies. */
type SessionOptions<T> = Omit<RequestOptions<T>, 'origin' | 'token'>;

/** The full request options: {@link options} plus the session's origin and, when set, token. */
function withSession<T>(session: ApiSession, options: SessionOptions<T>): RequestOptions<T> {
  return {
    ...options,
    origin: session.origin,
    ...(session.token === null ? {} : { token: session.token }),
  };
}

/**
 * Sends {@link options} to the session's instance with the session's token.
 * A null token omits the `token` option entirely, so the request carries no
 * `Authorization` header. Everything else is passed through unchanged; the
 * outcome is the one `apiRequest` produces.
 */
export async function sessionRequest<T>(
  session: ApiSession,
  options: SessionOptions<T>,
): Promise<Result<ApiResponse<T>, ApiError>> {
  return apiRequest(withSession(session, options));
}

/**
 * Sends {@link options} like {@link sessionRequest} and keeps only the
 * validated body, dropping the `Link` header. Endpoint functions that do not
 * page return the data directly, so this is their one unwrap; any failure is
 * passed through unchanged.
 */
export async function sessionRequestData<T>(
  session: ApiSession,
  options: SessionOptions<T>,
): Promise<Result<T, ApiError>> {
  return requestData(withSession(session, options));
}

/**
 * Sends {@link options} like {@link sessionRequest} for a list endpoint and
 * wraps the answer into a {@link Page} using its `Link` header; any failure is
 * passed through unchanged.
 */
export async function sessionRequestPage<T>(
  session: ApiSession,
  options: SessionOptions<readonly T[]>,
): Promise<Result<Page<T>, ApiError>> {
  const response = await sessionRequest(session, options);
  return response.ok ? ok(toPage(response.value)) : response;
}
