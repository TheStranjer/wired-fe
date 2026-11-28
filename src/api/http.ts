/**
 * The single HTTP entry point of the app (AGENTS.md "Security"): every API
 * call goes through {@link apiRequest}. It builds the URL (./url), sets the
 * auth and content headers, sends the request, and maps the outcome onto a
 * `Result` (./response): data validated against the caller's schema, or one
 * typed {@link ApiError}. It never throws, not even when the body read fails.
 */
import type * as v from 'valibot';

import type { ApiError } from './errors';
import { rejectionError } from './failure';
import { type ApiResponse, toApiResponse } from './response';
import { type QueryValue, buildUrl } from './url';
import { type Result, err, ok } from '../lib/result';

export type { ApiResponse, QueryValue };

/** Everything one API call needs; see {@link apiRequest}. */
export type RequestOptions<T> = {
  /** The instance origin, e.g. `https://wired.example`. */
  readonly origin: string;
  /** The request path, starting with `/`, e.g. `/api/v1/timelines/home`. */
  readonly path: string;
  /** The HTTP method; GET when omitted. */
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The account's bearer token, sent as `Authorization` when set. */
  readonly token?: string;
  /** Query parameters; `undefined` values are skipped. */
  readonly query?: Readonly<Record<string, QueryValue>>;
  /** A JSON request body; mutually exclusive with {@link RequestOptions.form}. */
  readonly json?: unknown;
  /** A multipart request body; mutually exclusive with {@link RequestOptions.json}. */
  readonly form?: FormData;
  /** Extra request headers, e.g. `Idempotency-Key`; the built-in headers win a clash. */
  readonly headers?: Readonly<Record<string, string>>;
  /** A signal that cancels the request, yielding the `aborted` error. */
  readonly signal?: AbortSignal | undefined;
  /** The schema the response body is validated against. */
  readonly schema: v.GenericSchema<unknown, T>;
};

/**
 * The headers a request carries: the caller's {@link RequestOptions.headers}
 * first, then the built-in ones — JSON acceptance, bearer auth, JSON content
 * type — which overwrite a clash with an extra header of the same name.
 */
function requestHeaders<T>(options: RequestOptions<T>): Record<string, string> {
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    Accept: 'application/json',
  };
  if (options.token !== undefined) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

/** The request body: JSON wins over the form data when both are given. */
function requestBody<T>(options: RequestOptions<T>): string | FormData | undefined {
  if (options.json !== undefined) {
    return JSON.stringify(options.json);
  }
  return options.form;
}

/** The fetch init built from the options, omitting the optional parts that are unset. */
function requestInit<T>(options: RequestOptions<T>): RequestInit {
  const body = requestBody(options);
  return {
    method: options.method ?? 'GET',
    headers: requestHeaders(options),
    ...(body === undefined ? {} : { body }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
}

/**
 * Sends the request; a rejection of `fetch()` becomes `aborted` or `network`,
 * never a throw. The body is read later, in `toApiResponse`, which maps its
 * own rejection the same way.
 */
async function send<T>(options: RequestOptions<T>): Promise<Result<Response, ApiError>> {
  const url = buildUrl(options.origin, options.path, options.query);
  try {
    return ok(await fetch(url, requestInit(options)));
  } catch (error) {
    return err(rejectionError(error));
  }
}

/**
 * Performs one API request and returns its typed outcome: the response body
 * validated against {@link RequestOptions.schema} together with the `Link`
 * header, or the {@link ApiError} explaining why the call failed. Never
 * throws: a rejection of the request or of the read of its body (an abort, a
 * dropped connection) comes back as `aborted` or `network`.
 */
export async function apiRequest<T>(
  options: RequestOptions<T>,
): Promise<Result<ApiResponse<T>, ApiError>> {
  const sent = await send(options);
  if (!sent.ok) {
    return sent;
  }
  return toApiResponse(sent.value, options.schema);
}

/**
 * Sends {@link apiRequest} and keeps only the validated body, dropping the
 * `Link` header; any failure is passed through unchanged.
 */
export async function requestData<T>(options: RequestOptions<T>): Promise<Result<T, ApiError>> {
  const response = await apiRequest(options);
  return response.ok ? ok(response.value.data) : response;
}
