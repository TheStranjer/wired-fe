/**
 * What sending from a thread window's docked box does (WFE-286, WFE-289,
 * decision 6): `//text` posts the literal `/text` as a reply; a line starting
 * with `/` is a command, run through the line runner the command line lends
 * (src/views/LineRunnerContext) after the thread window became the active one,
 * so the command acts on this thread; anything else is a reply to the window's
 * target post, exactly as the command line's plain text is (./threadReply).
 * A reply carries the box's own media — the alt text first, then the post, the
 * media emptied only once the post is up (src/state/postWithMedia); a command
 * leaves them alone. The answer is the message to show inside the box, or none.
 */

import { useState } from 'react';

import { postReply } from './threadReply';
import { currentMoment } from '../../lib/time';
import { type ComposerFields, type ComposerMedia, fieldsToDraft } from '../../state/draft';
import { postWithMedia } from '../../state/postWithMedia';
import { useRefreshDeps } from '../../state/RefreshContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { type LineRunner, useLineRunner } from '../../views/LineRunnerContext';
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

/** What a refused line says to the reader; null when it ran. */
async function refusal(run: LineRunner, line: string): Promise<string | null> {
  const outcome = await run([line]);
  return outcome.ok ? null : outcome.message;
}

/** The send and the activation of thread window {@link win}'s box, which holds {@link media}. */
export function useThreadSend(win: WindowState, media: readonly ComposerMedia[]): ThreadSend {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const run = useLineRunner();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activate = (): void => {
    dispatch({ type: 'windows', action: { type: 'activate', id: win.id } });
  };
  const reply = async (fields: ComposerFields, text: string): Promise<string | null> =>
    await postWithMedia({ state, dispatch, now: currentMoment, refresh }, win, {
      draft: { ...fieldsToDraft(fields), text },
      media,
      post: postReply,
    });
  const attempt = async (fields: ComposerFields): Promise<string | null> => {
    const { text } = fields;
    if (text.startsWith('//')) {
      return await reply(fields, text.slice(1));
    }
    if (!text.startsWith('/')) {
      return await reply(fields, text);
    }
    activate();
    // Let the app render the activation, so the line runs against it.
    await Promise.resolve();
    return await refusal(run, text);
  };
  const send = async (fields: ComposerFields): Promise<boolean> => {
    setSending(true);
    const failure = await attempt(fields);
    setSending(false);
    setError(failure);
    return failure === null;
  };
  return {
    sending: sending || media.some((item) => item.status === 'uploading'),
    error,
    send,
    activate,
  };
}
