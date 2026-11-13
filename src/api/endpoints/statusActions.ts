/**
 * The status action endpoints: `POST /api/v1/statuses/<id>/<action>` for the
 * eight Mastodon path segments that attach or detach one post — favourite,
 * reblog (boost), bookmark and pin, each with its undo. Wired, Mastodon and
 * Pleroma all serve them; the empty-bodied POST answers with a status, parsed
 * through the shared {@link StatusSchema} (decision 7). Note the asymmetry of
 * boosts: `reblog` returns the new boost wrapper status (its `reblog` field
 * holds the original), while `unreblog` returns the original. Whatever the
 * server sends is returned unchanged; callers handle the difference.
 */
import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Status, StatusSchema } from '../schemas/status';
import { type ApiSession, sessionRequestData } from '../session';

/** The eight action path segments, as Mastodon names them in the URL. */
export type StatusAction =
  'favourite' | 'unfavourite' | 'reblog' | 'unreblog' | 'bookmark' | 'unbookmark' | 'pin' | 'unpin';

/**
 * Applies {@link action} to status {@link id} of {@link session}'s instance:
 * one POST to `/api/v1/statuses/<id>/<action>` with the id percent-encoded
 * into one path segment. The answer is the status the server considers
 * current after the action (see the module note on `reblog`); any failure is
 * returned as the typed {@link ApiError} `apiRequest` produced.
 */
export async function statusAction(
  session: ApiSession,
  id: string,
  action: StatusAction,
): Promise<Result<Status, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/statuses/${encodeURIComponent(id)}/${action}`,
    method: 'POST',
    schema: StatusSchema,
  });
}
