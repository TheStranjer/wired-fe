/**
 * What sending from a DM window's docked box does (WFE-207, WFE-289): the
 * fields go out as the window says it (./directDraft) carrying the box's own
 * media — the alt text first, then the post, and the media are emptied only
 * once the post is up (src/state/postWithMedia). Media without a description
 * are first reviewed in the modal (WFE-290, src/state/mediaReview): cancelling
 * it sends nothing and resolves to not sent, so the box keeps its text. The
 * answer is the message to show inside the box, or none; a send waits while a
 * file is still uploading.
 */

import { useState } from 'react';

import { postDirect } from './directDraft';
import { currentMoment } from '../../lib/time';
import { type ComposerFields, type ComposerMedia, fieldsToDraft } from '../../state/draft';
import { reviewed } from '../../state/mediaReview';
import { postWithMedia } from '../../state/postWithMedia';
import { useRefreshDeps } from '../../state/RefreshContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { useReviewMedia } from '../../views/MediaReviewContext';
import type { WindowState } from '../../windows/model';

/** What the box knows of its sending, and how to send. */
export type DirectSend = {
  /** A send is in flight, or a file is still going up. */
  readonly sending: boolean;
  /** The message of the last failure; null while none. */
  readonly error: string | null;
  /** Send {@link ComposerFields}; resolves to whether it went through. */
  readonly send: (fields: ComposerFields) => Promise<boolean>;
};

/** The send of DM window {@link win}'s box, which holds {@link media}. */
export function useDirectSend(win: WindowState, media: readonly ComposerMedia[]): DirectSend {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const review = useReviewMedia();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(fields: ComposerFields): Promise<boolean> {
    setSending(true);
    const checked = await reviewed(review, win.id, media);
    if (checked === null) {
      setSending(false);
      return false;
    }
    const context = { state, dispatch, now: currentMoment, refresh };
    const failure = await postWithMedia(context, win, {
      draft: fieldsToDraft(fields),
      media: checked,
      post: postDirect,
    });
    setSending(false);
    setError(failure);
    return failure === null;
  }

  return { sending: sending || media.some((item) => item.status === 'uploading'), error, send };
}
