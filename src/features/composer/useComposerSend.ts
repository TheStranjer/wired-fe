/**
 * How the composer window sends (decision 13): the draft goes out as the
 * window's account through the same create every postable window uses
 * (src/state/postStatus), carrying the ids of the attachments that are ready
 * and, just before, the alt text the reader typed on their lines
 * (src/state/describeMedia). A pane is persistent, so success clears the fields
 * and the attachments and keeps the window, and says so in the window's own
 * scrollback; a failure stays inside the form for the retry. While a file is
 * still uploading the form is busy: sending waits for its id. A reply composer
 * (WFE-244) has served its purpose once its answer is up, and a quote composer
 * (WFE-262) once its quote is: success closes the window and says so in the
 * status window. The draft goes out as the window's account, which a bound
 * composer was opened for — the account of the line it came from — and
 * {@link fieldsToDraft} carries the `inReplyToId` or `quoteId`. An edit
 * composer (WFE-268) saves the post instead of creating one, through
 * src/state/editPost: the new text and content warning over what the post
 * keeps; it closes on success with `✎ edited [a4]` in the status window, and a
 * failure keeps the text and shows the message. A send carrying an attachment
 * without a description first has the reader review them all in a modal
 * (WFE-290, src/state/mediaReview): cancelling it sends nothing and keeps the
 * fields and the attachments, with the descriptions typed there.
 */

import { useState } from 'react';

import type { Status } from '../../api/schemas/status';
import { type Result, err } from '../../lib/result';
import { type AppState, printAction } from '../../state/appState';
import { composerFields } from '../../state/composerActions';
import { composerMediaOf, draftWithMedia } from '../../state/composerMedia';
import { describeMedia } from '../../state/describeMedia';
import {
  type ComposerFields,
  type ComposerMedia,
  type Draft,
  fieldsToDraft,
} from '../../state/draft';
import { editPost, editedNote } from '../../state/editPost';
import { type ReviewMedia, reviewed } from '../../state/mediaReview';
import { createPost } from '../../state/postStatus';
import { useRefreshDeps } from '../../state/RefreshContext';
import { type Dispatch, useAppDispatch, useAppState } from '../../state/StateContext';
import type { PostContext } from '../../state/windowKind';
import { useReviewMedia } from '../../views/MediaReviewContext';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** What the form needs of a send: whether one is in flight, its failure, and the trigger. */
export type ComposerSend = {
  readonly fields: ComposerFields;
  /** A send is in flight, or an attachment is still going up. */
  readonly sending: boolean;
  readonly error: string | null;
  readonly send: () => void;
};

/** The alt text first, then the post: the first refusal is the message to show. */
async function publish(
  context: Pick<PostContext, 'state' | 'dispatch' | 'refresh'>,
  accountKey: string | null,
  what: { readonly draft: Draft; readonly media: readonly ComposerMedia[] },
): Promise<Result<Status, string>> {
  const refused = await describeMedia(context, accountKey, what.media);
  return refused === null ? await createPost(context, accountKey, what.draft) : err(refused);
}

/** The composer window that sent, the fields it sent from and the app state it sent in. */
type SentWindow = {
  readonly windowId: string;
  readonly fields: ComposerFields;
  readonly state: AppState;
};

/** What one send works from: how to post, how to ask the reader, as whom, and from which window. */
type Sending = {
  readonly context: Pick<PostContext, 'state' | 'dispatch' | 'refresh'>;
  readonly review: ReviewMedia;
  readonly accountKey: string | null;
  readonly origin: SentWindow;
};

/**
 * The post, or the edit of a composer that edits. A post first has the reader
 * review the alt text of its attachments (WFE-290): null when they cancelled,
 * so nothing goes out.
 */
async function create(send: Sending): Promise<Result<Status, string> | null> {
  const { context, review, accountKey, origin } = send;
  const { windowId, fields, state } = origin;
  const draft = fieldsToDraft(fields);
  if (fields.editing !== undefined) {
    const { status } = fields.editing;
    return await editPost(context, accountKey, { status, draft, now: new Date() });
  }
  const media = await reviewed(review, windowId, composerMediaOf(state, windowId));
  if (media === null) {
    return null;
  }
  return await publish(context, accountKey, { draft: draftWithMedia(draft, media), media });
}

/** The line a bound composer leaves in the status window once its post is up; null for a plain one. */
function closingNote(origin: SentWindow, created: Status): string | null {
  const { fields, state } = origin;
  if (fields.inReplyTo !== undefined) {
    return `↳ replied to @${created.account.acct}`;
  }
  if (fields.editing !== undefined) {
    return editedNote(state, fields.editing.status);
  }
  return fields.quoteOf === undefined ? null : `❝ quoted @${fields.quoteOf.status.account.acct}`;
}

/**
 * What a successful send leaves behind: a reply, quote or edit composer closes
 * (its post is up, WFE-244, WFE-262, WFE-268) and says so in the status window;
 * any other clears its fields and attachments and confirms in its own scrollback.
 */
function sent(dispatch: Dispatch, origin: SentWindow, created: Status): void {
  const { windowId } = origin;
  const note = closingNote(origin, created);
  if (note !== null) {
    dispatch({ type: 'windows', action: { type: 'close', id: windowId } });
    dispatch(printAction(STATUS_WINDOW_ID, 'info', note));
    return;
  }
  dispatch({
    type: 'composerEdit',
    windowId,
    patch: { text: '', spoiler: '', poll: undefined, mediaIds: undefined },
  });
  dispatch({ type: 'composerMediaClear', windowId });
  dispatch(printAction(windowId, 'info', `Posted as @${created.account.acct}`));
}

/** The sending state of window {@link windowId}'s composer, and its trigger. */
export function useComposerSend(windowId: string, accountKey: string | null): ComposerSend {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const review = useReviewMedia();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = composerFields(state, windowId);
  const media = composerMediaOf(state, windowId);

  async function submit(): Promise<void> {
    setSending(true);
    const context = { state, dispatch, refresh };
    const created = await create({
      context,
      review,
      accountKey,
      origin: { windowId, fields, state },
    });
    setSending(false);
    if (created === null) {
      return;
    }
    if (!created.ok) {
      setError(created.error);
      return;
    }
    setError(null);
    sent(dispatch, { windowId, fields, state }, created.value);
  }

  return {
    fields,
    sending: sending || media.some((item) => item.status === 'uploading'),
    error,
    send: () => {
      void submit();
    },
  };
}
