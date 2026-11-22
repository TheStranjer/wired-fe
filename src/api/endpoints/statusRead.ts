/**
 * The status read endpoints: `GET /api/v1/statuses/<id>` for one post and
 * `GET /api/v1/statuses/<id>/context` for the conversation around it. Wired,
 * Mastodon and Pleroma all serve both; the answers come through the shared
 * {@link StatusSchema} and {@link ContextSchema} (decision 7). Ids are
 * percent-encoded into one path segment; the optional signal cancels the
 * request, which answers the `aborted` error.
 */
import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Context, ContextSchema } from '../schemas/context';
import { type Status, StatusSchema } from '../schemas/status';
import { type ApiSession, sessionRequestData } from '../session';

/**
 * Status {@link id} of {@link session}'s instance: one GET to
 * `/api/v1/statuses/<id>` with the id percent-encoded into one path segment.
 * The answer is the parsed status; any failure is the typed {@link ApiError}
 * `apiRequest` produced.
 */
export async function getStatus(
  session: ApiSession,
  id: string,
  signal?: AbortSignal,
): Promise<Result<Status, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/statuses/${encodeURIComponent(id)}`,
    schema: StatusSchema,
    signal,
  });
}

/**
 * The conversation around status {@link id} of {@link session}'s instance:
 * one GET to `/api/v1/statuses/<id>/context` with the id percent-encoded into
 * one path segment. The answer is the ancestors above and descendants below
 * the post, parsed through {@link ContextSchema}; any failure is the typed
 * {@link ApiError} `apiRequest` produced.
 */
export async function getContext(
  session: ApiSession,
  id: string,
  signal?: AbortSignal,
): Promise<Result<Context, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/statuses/${encodeURIComponent(id)}/context`,
    schema: ContextSchema,
    signal,
  });
}
