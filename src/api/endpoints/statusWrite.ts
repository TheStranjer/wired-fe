/**
 * The status write endpoints: `POST /api/v1/statuses` creates a post,
 * `PUT /api/v1/statuses/<id>` edits one and `DELETE /api/v1/statuses/<id>`
 * removes it, all three answering with the current status parsed through the
 * shared {@link StatusSchema} (decision 7). Mastodon-compatible servers
 * deduplicate creation by the mandatory `Idempotency-Key` header, so a retried
 * send posts once. The request body carries snake_case keys only for the
 * fields the caller set; visibility `'local'` is a Wired audience sent as-is,
 * and callers check capabilities (decision 5) before offering it. Editing
 * takes only the text-side fields: visibility, the replied-to id and the
 * quote are fixed when the post is created.
 */
import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Status, type Visibility, StatusSchema } from '../schemas/status';
import { type ApiSession, sessionRequestData } from '../session';

/** Everything a caller can set when creating a post; `status` is the text. */
export type NewStatus = {
  readonly status: string;
  readonly spoilerText?: string;
  readonly visibility?: Visibility;
  readonly sensitive?: boolean;
  readonly inReplyToId?: string;
  readonly mediaIds?: readonly string[];
  readonly language?: string;
  readonly poll?: {
    readonly options: readonly string[];
    readonly expiresIn: number;
    readonly multiple: boolean;
    /** Keep the vote counts hidden until the poll ends; unset sends nothing. */
    readonly hideTotals?: boolean;
  };
  readonly quoteId?: string;
};

/** The JSON body of a create or edit: snake_case keys, only for the fields set. */
function statusBody(input: NewStatus): Record<string, unknown> {
  return {
    status: input.status,
    ...(input.spoilerText === undefined ? {} : { spoiler_text: input.spoilerText }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    ...(input.sensitive === undefined ? {} : { sensitive: input.sensitive }),
    ...(input.inReplyToId === undefined ? {} : { in_reply_to_id: input.inReplyToId }),
    ...(input.mediaIds === undefined ? {} : { media_ids: input.mediaIds }),
    ...(input.language === undefined ? {} : { language: input.language }),
    ...(input.poll === undefined
      ? {}
      : {
          poll: {
            options: input.poll.options,
            expires_in: input.poll.expiresIn,
            multiple: input.poll.multiple,
            ...(input.poll.hideTotals === undefined ? {} : { hide_totals: input.poll.hideTotals }),
          },
        }),
    ...(input.quoteId === undefined ? {} : { quote_id: input.quoteId }),
  };
}

/**
 * Creates a post on {@link session}'s instance: one POST to
 * `/api/v1/statuses` with {@link statusBody}'s mapping and the
 * `Idempotency-Key: <idempotencyKey>` header, so servers deduplicate a retry
 * of the same key. The answer is the created status; any failure is the typed
 * {@link ApiError} `apiRequest` produced.
 */
export async function createStatus(
  session: ApiSession,
  input: NewStatus,
  idempotencyKey: string,
): Promise<Result<Status, ApiError>> {
  return sessionRequestData(session, {
    path: '/api/v1/statuses',
    method: 'POST',
    json: statusBody(input),
    headers: { 'Idempotency-Key': idempotencyKey },
    schema: StatusSchema,
  });
}

/**
 * Edits status {@link id} of {@link session}'s instance: a PUT to
 * `/api/v1/statuses/<id>` with the id percent-encoded into one path segment
 * and the mapped body of the editable fields only. The answer is the edited
 * status as the server now sees it.
 */
export async function editStatus(
  session: ApiSession,
  id: string,
  input: Omit<NewStatus, 'visibility' | 'inReplyToId' | 'quoteId'>,
): Promise<Result<Status, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/statuses/${encodeURIComponent(id)}`,
    method: 'PUT',
    json: statusBody(input),
    schema: StatusSchema,
  });
}

/**
 * Deletes status {@link id} of {@link session}'s instance: a DELETE to
 * `/api/v1/statuses/<id>`. The answer is the deleted status — Mastodon sends
 * it back — parsed through {@link StatusSchema}; any failure is the typed
 * {@link ApiError} `apiRequest` produced.
 */
export async function deleteStatus(
  session: ApiSession,
  id: string,
): Promise<Result<Status, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/statuses/${encodeURIComponent(id)}`,
    method: 'DELETE',
    schema: StatusSchema,
  });
}
