/**
 * The one way a postable window sends its draft (AGENTS.md "The command line is
 * the composer"): the window's own account signs it, the reader's default
 * audience fills an unset one, and the status the instance answers with is
 * added to that same window's scrollback as newer — the post shows the reader
 * where they are looking the moment it exists. Every postable window kind shares
 * this helper (src/state/windowKind), so a home window, a thread and a DM
 * behave alike; it resolves to the message to show the reader, or to null when
 * the post went through. The idempotency key is a fresh uuid, so a retried send
 * is one post (src/api/endpoints/statusWrite), also when an expired token is
 * refreshed and the create retried (./refreshSession).
 */

import { type Draft, draftToNewStatus } from './draft';
import { statusesAction } from './pageActions';
import { withFreshToken } from './refreshSession';
import { accountByKey } from './selectors';
import type { PostContext } from './windowKind';
import { createStatus } from '../api/endpoints/statusWrite';
import { describeApiError } from '../api/errors';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';

/**
 * Creates the status for {@link params.accountKey} through the session that
 * account gives, and adds it to `params.windowId` as newer. Returns the error
 * to print, or null when the post is up: no session at all, or whatever
 * {@link describeApiError} says of a failed create.
 */
export async function postStatus(
  context: PostContext,
  params: {
    readonly accountKey: string | null;
    readonly windowId: string;
    readonly draft: Draft;
  },
): Promise<string | null> {
  const { state, dispatch } = context;
  const account = accountByKey(state, params.accountKey);
  if (account === null) {
    return NOT_LOGGED_IN_MESSAGE;
  }
  const refresh = context.refresh ?? { refresher: null, dispatch, getState: () => state };
  const status = draftToNewStatus(params.draft, state.settings.defaultVisibility);
  const key = crypto.randomUUID();
  const created = await withFreshToken(
    refresh,
    account.key,
    async (session) => await createStatus(session, status, key),
  );
  if (!created.ok) {
    return describeApiError(created.error);
  }
  dispatch(statusesAction(params.windowId, [created.value], 'newer'));
  return null;
}
