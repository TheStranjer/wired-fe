/**
 * How the composer window sends (decision 13): the draft goes out as the
 * window's account through the same create every postable window uses
 * (src/state/postStatus), carrying the ids of the attachments that are ready
 * and, just before, the alt text the reader typed on their lines
 * (src/state/describeMedia). A pane is persistent, so success clears the fields
 * and the attachments and keeps the window, and says so in the window's own
 * scrollback; a failure stays inside the form for the retry. While a file is
 * still uploading the form is busy: sending waits for its id.
 */

import { useState } from 'react';

import type { Status } from '../../api/schemas/status';
import { type Result, err } from '../../lib/result';
import { printAction } from '../../state/appState';
import { composerFields } from '../../state/composerActions';
import { composerMediaOf, draftWithMedia } from '../../state/composerMedia';
import { describeMedia } from '../../state/describeMedia';
import {
  type ComposerFields,
  type ComposerMedia,
  type Draft,
  fieldsToDraft,
} from '../../state/draft';
import { createPost } from '../../state/postStatus';
import { useRefreshDeps } from '../../state/RefreshContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import type { PostContext } from '../../state/windowKind';

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

/** The sending state of window {@link windowId}'s composer, and its trigger. */
export function useComposerSend(windowId: string, accountKey: string | null): ComposerSend {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = composerFields(state, windowId);
  const media = composerMediaOf(state, windowId);

  async function submit(): Promise<void> {
    setSending(true);
    const created = await publish({ state, dispatch, refresh }, accountKey, {
      draft: draftWithMedia(fieldsToDraft(fields), media),
      media,
    });
    setSending(false);
    if (!created.ok) {
      setError(created.error);
      return;
    }
    setError(null);
    dispatch({
      type: 'composerEdit',
      windowId,
      patch: { text: '', spoiler: '', poll: undefined, mediaIds: undefined },
    });
    dispatch({ type: 'composerMediaClear', windowId });
    dispatch(printAction(windowId, 'info', `Posted as @${created.value.account.acct}`));
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
