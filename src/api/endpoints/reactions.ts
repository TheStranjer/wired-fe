/**
 * The emoji reaction endpoints (WBE-178): `PUT` and
 * `DELETE /api/v1/pleroma/statuses/<id>/reactions/<emoji>` attach and detach
 * one emoji reaction on a post, the route Pleroma invented and Wired and
 * Akkoma serve. Both the status id and the emoji — a Unicode emoji or, for a
 * custom reaction, the bare shortcode — are percent-encoded into one path
 * segment, the request carries no body, and the answer is the status as the
 * server now reports it, its `pleroma` block holding the updated
 * `emoji_reactions`, parsed through the shared {@link StatusSchema}
 * (decision 7). Whether the instance serves these routes at all is a
 * capability question (`emojiReactions`, `customEmojiReactions`): only
 * callers above this layer that have read the instance's Capabilities may
 * send them.
 */
import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Status, StatusSchema } from '../schemas/status';
import { type ApiSession, sessionRequestData } from '../session';

/** The one path both verbs answer on, each name encoded into one segment. */
function reactionPath(statusId: string, emoji: string): string {
  const id = encodeURIComponent(statusId);
  const name = encodeURIComponent(emoji);
  return `/api/v1/pleroma/statuses/${id}/reactions/${name}`;
}

/**
 * Adds {@link emoji} as this session's reaction to status {@link statusId}:
 * one PUT to `/api/v1/pleroma/statuses/<id>/reactions/<emoji>` with no body.
 * The answer is the updated status; any failure is the typed {@link ApiError}
 * `apiRequest` produced.
 */
export async function react(
  session: ApiSession,
  statusId: string,
  emoji: string,
): Promise<Result<Status, ApiError>> {
  return sessionRequestData(session, {
    path: reactionPath(statusId, emoji),
    method: 'PUT',
    schema: StatusSchema,
  });
}

/**
 * Removes this session's {@link emoji} reaction from status
 * {@link statusId}: one DELETE to the same path the reaction arrived on. The
 * answer is the status as it stands without the reaction; any failure is the
 * typed {@link ApiError} `apiRequest` produced.
 */
export async function unreact(
  session: ApiSession,
  statusId: string,
  emoji: string,
): Promise<Result<Status, ApiError>> {
  return sessionRequestData(session, {
    path: reactionPath(statusId, emoji),
    method: 'DELETE',
    schema: StatusSchema,
  });
}
