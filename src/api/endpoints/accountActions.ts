/**
 * The account action endpoints: `POST /api/v1/accounts/<id>/<action>` for the
 * six Mastodon path segments that attach or detach the session's account from
 * another one — follow, block and mute, each with its undo. Wired, Mastodon
 * and Pleroma all serve them; every answer is the session's current
 * {@link Relationship} towards the target, parsed through the shared
 * {@link RelationshipSchema} (decision 7). Only two actions take options:
 * follow a `reblogs` flag, mute `notifications` and `duration`. The body
 * carries those keys only when set, and every other call goes out with no
 * body at all; options irrelevant to the action asked are ignored.
 */
import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Relationship, RelationshipSchema } from '../schemas/relationship';
import { type ApiSession, sessionRequestData } from '../session';

/** The six action path segments, as Mastodon names them in the URL. */
export type AccountAction = 'follow' | 'unfollow' | 'block' | 'unblock' | 'mute' | 'unmute';

/**
 * The options the two option-taking actions accept; every other action
 * ignores all of them. {@link reblogs} belongs to `follow`: whether the new
 * follow also brings the target's reblogs, on unless a caller turns it off.
 * {@link notifications} and {@link duration} belong to `mute`: whether the
 * mute also silences the target's notifications (true server-side unless
 * said otherwise) and how many seconds it lasts, `0` meaning forever.
 */
export type AccountActionOptions = {
  /** `follow` only: receive the target's reblogs. */
  readonly reblogs?: boolean;
  /** `mute` only: also mute the target's notifications. */
  readonly notifications?: boolean;
  /** `mute` only: seconds until the mute ends, `0` for forever. */
  readonly duration?: number;
};

/**
 * The JSON body an action carries: each option its action understands, and
 * only when the caller set it. An action with no options to send — every
 * undo, and follow or mute asked with nothing set — gets `undefined`, so the
 * request goes out with no body at all.
 */
function actionBody(
  action: AccountAction,
  options: AccountActionOptions,
): Record<string, unknown> | undefined {
  const body: Record<string, unknown> = {
    ...(action === 'follow' && options.reblogs !== undefined ? { reblogs: options.reblogs } : {}),
    ...(action === 'mute' && options.notifications !== undefined
      ? { notifications: options.notifications }
      : {}),
    ...(action === 'mute' && options.duration !== undefined ? { duration: options.duration } : {}),
  };
  return Object.keys(body).length === 0 ? undefined : body;
}

/**
 * Applies {@link action} to account {@link id} of {@link session}'s instance:
 * one POST to `/api/v1/accounts/<id>/<action>` with the id percent-encoded
 * into one path segment and only {@link actionBody}'s body — follow and mute
 * may carry their options, every other call goes out bare. The answer is the
 * relationship as the server now sees it; any failure is the typed
 * {@link ApiError} `apiRequest` produced. The trailing options ride a rest
 * tuple so the four arguments this interface fixes still fit the parameter cap.
 */
export async function accountAction(
  session: ApiSession,
  id: string,
  ...[action, options = {}]: [action: AccountAction, options?: AccountActionOptions]
): Promise<Result<Relationship, ApiError>> {
  const body = actionBody(action, options);
  return sessionRequestData(session, {
    path: `/api/v1/accounts/${encodeURIComponent(id)}/${action}`,
    method: 'POST',
    ...(body === undefined ? {} : { json: body }),
    schema: RelationshipSchema,
  });
}
