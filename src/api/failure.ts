/**
 * Turns anything a request step rejects with, whether `fetch()` or the later
 * read of the response body, into the one {@link ApiError} the caller gets,
 * so a transport failure is never a throw.
 */
import type { ApiError } from './errors';

/** Whether a rejection is the abort of the request's own signal. */
function isAborted(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/** The `network` error message: the error's own message, or its string form. */
function failureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** The error of a rejected request step: `aborted` for an abort, else `network` carrying the message. */
export function rejectionError(error: unknown): ApiError {
  return isAborted(error)
    ? { kind: 'aborted' }
    : { kind: 'network', message: failureMessage(error) };
}
