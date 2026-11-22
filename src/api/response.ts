/**
 * Response handling for `apiRequest`: maps a fetch `Response` onto the
 * `Result` the caller receives. 429 answers become `rate-limited` with the
 * parsed `X-RateLimit-Reset`; other non-2xx become `http` carrying the remote
 * JSON `error` string or the status text; 2xx bodies are read, validated
 * against the caller's schema, and paired with the raw `Link` header.
 */
import * as v from 'valibot';

import type { ApiError } from './errors';
import { type Result, err, ok } from '../lib/result';

/**
 * A successful API response: the schema-validated {@link ApiResponse.data},
 * plus the raw `Link` header in {@link ApiResponse.link} for the pagination
 * parser to page with.
 */
export type ApiResponse<T> = {
  readonly data: T;
  readonly link: string | null;
};

/** A schema for answers whose body does not matter: any 2xx body (usually `{}`) becomes null. */
export const NothingSchema: v.GenericSchema<unknown, null> = v.pipe(
  v.any(),
  v.transform(() => null),
);

/** The `X-RateLimit-Reset` header as a date; null when absent or unparseable. */
function rateLimitReset(headers: Headers): Date | null {
  const raw = headers.get('X-RateLimit-Reset');
  if (raw === null) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The `error` string of a remote JSON error object, if the body has one. */
function remoteError(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const message: unknown = body.error;
    if (typeof message === 'string') {
      return message;
    }
  }
  return null;
}

/** The `http` error of a failed response: the remote message, else the status line. */
async function httpError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const statusText = response.statusText === '' ? 'Request failed' : response.statusText;
  return { kind: 'http', status: response.status, message: remoteError(body) ?? statusText };
}

/** The `parse` error naming the first issue and its dot path, `(root)` when pathless. */
function parseError(issues: readonly [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): ApiError {
  const [issue] = issues;
  const path = v.getDotPath(issue) ?? '(root)';
  return { kind: 'parse', message: `${path}: ${issue.message}` };
}

/** Validates a decoded body against the caller's schema. */
function validate<T>(body: unknown, schema: v.GenericSchema<unknown, T>): Result<T, ApiError> {
  const result = v.safeParse(schema, body);
  if (result.success) {
    return ok(result.output);
  }
  return err(parseError(result.issues));
}

/** Reads a 2xx body: a 204 or an empty body validates as `null`, anything else must be JSON. */
async function decodeBody<T>(
  response: Response,
  schema: v.GenericSchema<unknown, T>,
): Promise<Result<T, ApiError>> {
  const text = await response.text();
  if (response.status === 204 || text === '') {
    return validate(null, schema);
  }
  try {
    return validate(JSON.parse(text), schema);
  } catch {
    return err({ kind: 'parse', message: 'Invalid JSON' });
  }
}

/** Maps any response onto the `Result` `apiRequest` hands back to its caller. */
export async function toApiResponse<T>(
  response: Response,
  schema: v.GenericSchema<unknown, T>,
): Promise<Result<ApiResponse<T>, ApiError>> {
  if (response.status === 429) {
    return err({ kind: 'rate-limited', resetAt: rateLimitReset(response.headers) });
  }
  if (!response.ok) {
    return err(await httpError(response));
  }
  const data = await decodeBody(response, schema);
  if (!data.ok) {
    return data;
  }
  return ok({ data: data.value, link: response.headers.get('Link') });
}
