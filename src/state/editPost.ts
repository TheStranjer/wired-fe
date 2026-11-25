/**
 * Saving an edit from the edit composer (WFE-268, decision 13): the window's
 * account signs a `PUT` of the post through {@link editStatus}, with the new
 * text and content warning on top of what {@link editFields} keeps of the post
 * (its media, sensitivity, language and poll). The status the instance answers
 * replaces the post in every buffer, and {@link editedNote} names the line the
 * post has in the windows, as `/edit` does. Like {@link createPost} it also
 * recovers from an expired token, and a failure comes back as the message to
 * show, leaving the draft alone.
 */

import type { AppState } from './appState';
import type { Buffer } from './buffer';
import { labelForStatus, statusOfLine } from './bufferSelection';
import { composerLimits } from './composerActions';
import type { Draft } from './draft';
import { editFields } from './editFields';
import { withFreshToken } from './refreshSession';
import { accountByKey } from './selectors';
import type { PostContext } from './windowKind';
import { editStatus } from '../api/endpoints/statusWrite';
import { describeApiError } from '../api/errors';
import type { Status } from '../api/schemas/status';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';
import { type Result, err } from '../lib/result';

/** What an edit changes: the post, its new draft and the moment it is sent. */
export type PostEdit = {
  readonly status: Status;
  readonly draft: Draft;
  readonly now: Date;
};

/**
 * Edits {@link edit}'s post as {@link accountKey}: the draft's text and
 * content warning (an empty one clears it) over the post's own state. On
 * success the answered status is dispatched to every buffer and handed back;
 * otherwise the message to show: no session, a closed poll, or whatever
 * {@link describeApiError} says of the failed edit.
 */
export async function editPost(
  context: Pick<PostContext, 'state' | 'dispatch' | 'refresh'>,
  accountKey: string | null,
  edit: PostEdit,
): Promise<Result<Status, string>> {
  const { state, dispatch } = context;
  const account = accountByKey(state, accountKey);
  if (account === null) {
    return err(NOT_LOGGED_IN_MESSAGE);
  }
  const kept = editFields(edit.status, composerLimits(state, account.key).pollLimits, edit.now);
  if (!kept.ok) {
    return err(kept.error);
  }
  const { text, spoilerText = '' } = edit.draft;
  const input = { ...kept.value, status: text, spoilerText };
  const refresh = context.refresh ?? { refresher: null, dispatch, getState: () => state };
  const edited = await withFreshToken(
    refresh,
    account.key,
    async (session) => await editStatus(session, edit.status.id, input),
  );
  if (!edited.ok) {
    return err(describeApiError(edited.error));
  }
  dispatch({ type: 'statusUpdated', status: edited.value });
  return edited;
}

/** The label {@link buffer} gave the line that shows {@link status} or its boost; null when it shows none. */
function labelIn(buffer: Buffer, status: Status): string | null {
  for (const line of buffer.lines) {
    const shown = statusOfLine(line);
    if (shown !== null && (shown.id === status.id || shown.reblog?.id === status.id)) {
      return labelForStatus(buffer, shown.id);
    }
  }
  return null;
}

/**
 * The label the first window that shows {@link status} gave it (`a4`), the
 * bare id for a post no window labelled: what the edit composer names the post
 * by, since the composer's own scrollback shows no posts.
 */
export function postLabel(state: AppState, status: Status): string {
  for (const buffer of state.buffers.values()) {
    const label = labelIn(buffer, status);
    if (label !== null) {
      return label;
    }
  }
  return status.id;
}

/** The line `✎ edited [a4]` for {@link status}, as `/edit` prints it. */
export function editedNote(state: AppState, status: Status): string {
  return `✎ edited [${postLabel(state, status)}]`;
}
