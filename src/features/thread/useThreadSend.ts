/**
 * What sending from a thread window's docked box does (WFE-286, WFE-289,
 * decision 6): `//text` posts the literal `/text` as a reply; a line starting
 * with `/` is a command, run through the line runner the command line lends
 * (src/views/LineRunnerContext) after the thread window became the active one,
 * so the command acts on this thread; anything else is a reply to the window's
 * target post, exactly as the command line's plain text is (./threadReply).
 * A reply carries the box's own media — the alt text first, then the post, the
 * media emptied only once the post is up (src/state/postWithMedia); a command
 * leaves them alone. Media without a description are first reviewed in the
 * modal (WFE-290, src/state/mediaReview): cancelling it sends nothing and
 * leaves the box as it was. The answer is the message to show inside the box,
 * or none.
 */

import { useState } from 'react';

import { postReply } from './threadReply';
import { currentMoment } from '../../lib/time';
import { type ComposerFields, type ComposerMedia, fieldsToDraft } from '../../state/draft';
import { type ReviewMedia, reviewed } from '../../state/mediaReview';
import { postWithMedia } from '../../state/postWithMedia';
import { useRefreshDeps } from '../../state/RefreshContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import type { PostContext } from '../../state/windowKind';
import { type LineRunner, useLineRunner } from '../../views/LineRunnerContext';
import { useReviewMedia } from '../../views/MediaReviewContext';
import type { WindowState } from '../../windows/model';

/** What the box knows of its sending, and how to send. */
export type ThreadSend = {
  /** A send is in flight, or a file is still going up. */
  readonly sending: boolean;
  /** The message of the last failure or refusal; null while none. */
  readonly error: string | null;
  /** Send {@link ComposerFields}; resolves to whether it went through. */
  readonly send: (fields: ComposerFields) => Promise<boolean>;
  /** Make the window active, as clicking its pane does. */
  readonly activate: () => void;
};

/** How one send ended: whether it went through, and the message to show when it failed. A cancelled review is neither. */
type Attempt = { readonly sent: boolean; readonly error: string | null };

/** The {@link Attempt} that ended with {@link failure}, null when it went through. */
function settled(failure: string | null): Attempt {
  return { sent: failure === null, error: failure };
}

/** What one send works with: the window and its media, how to post, ask the reader, and run a line. */
type Sender = {
  readonly win: WindowState;
  readonly media: readonly ComposerMedia[];
  readonly context: PostContext;
  readonly review: ReviewMedia;
  readonly run: LineRunner;
  readonly activate: () => void;
};

/** What a refused line says to the reader; none when it ran. */
async function refusal(run: LineRunner, line: string): Promise<Attempt> {
  const outcome = await run([line]);
  return settled(outcome.ok ? null : outcome.message);
}

/** Reply with {@link text} and the fields' audience, after the reader reviewed the media; nothing goes out when they cancelled. */
async function reply(send: Sender, fields: ComposerFields, text: string): Promise<Attempt> {
  const checked = await reviewed(send.review, send.win.id, send.media);
  if (checked === null) {
    return { sent: false, error: null };
  }
  const failure = await postWithMedia(send.context, send.win, {
    draft: { ...fieldsToDraft(fields), text },
    media: checked,
    post: postReply,
  });
  return settled(failure);
}

/** What the text of {@link fields} asks: a literal slash line, a plain reply, or a command. */
async function attempt(send: Sender, fields: ComposerFields): Promise<Attempt> {
  const { text } = fields;
  if (text.startsWith('//')) {
    return await reply(send, fields, text.slice(1));
  }
  if (!text.startsWith('/')) {
    return await reply(send, fields, text);
  }
  send.activate();
  // Let the app render the activation, so the line runs against it.
  await Promise.resolve();
  return await refusal(send.run, text);
}

/** The send and the activation of thread window {@link win}'s box, which holds {@link media}. */
export function useThreadSend(win: WindowState, media: readonly ComposerMedia[]): ThreadSend {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const run = useLineRunner();
  const review = useReviewMedia();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activate = (): void => {
    dispatch({ type: 'windows', action: { type: 'activate', id: win.id } });
  };
  const context = { state, dispatch, now: currentMoment, refresh };
  const send = async (fields: ComposerFields): Promise<boolean> => {
    setSending(true);
    const result = await attempt({ win, media, context, review, run, activate }, fields);
    setSending(false);
    setError(result.error);
    return result.sent;
  };
  return {
    sending: sending || media.some((item) => item.status === 'uploading'),
    error,
    send,
    activate,
  };
}
