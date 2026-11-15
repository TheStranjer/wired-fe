/**
 * The one way a postable window sends its draft (AGENTS.md "The command line is
 * the composer"): the window's own account signs it, the reader's default
 * audience fills an unset one, and the status the instance answers with is
 * added to that same window's scrollback as newer — the post shows the reader
 * where they are looking the moment it exists. Every postable window kind shares
 * this helper (src/state/windowKind), so a home window, a thread and a DM
 * behave alike; it resolves to the message to show the reader, or to null when
 * the post went through. The idempotency key is a fresh uuid, so a retried send
 * is one post (src/api/endpoints/statusWrite).
 */

import { type Draft, draftToNewStatus } from './draft';
import { sessionFor } from './selectors';
import type { PostContext } from './windowKind';
import { createStatus } from '../api/endpoints/statusWrite';
import { describeApiError } from '../api/errors';

/** What every window says when it is asked to post with nobody signed in. */
const NOT_LOGGED_IN = 'Not logged in. Type /connect';

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
  const session = sessionFor(state, params.accountKey);
  if (session === null) {
    return NOT_LOGGED_IN;
  }
  const created = await createStatus(
    session,
    draftToNewStatus(params.draft, state.settings.defaultVisibility),
    crypto.randomUUID(),
  );
  if (!created.ok) {
    return describeApiError(created.error);
  }
  dispatch({
    type: 'statuses',
    windowId: params.windowId,
    statuses: [created.value],
    where: 'newer',
  });
  return null;
}
