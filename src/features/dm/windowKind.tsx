/**
 * The `dm` window kind (AGENTS.md "Windows, like IRC buffers", WFE-108): one
 * private conversation, the buffer `/query` opens. ./useDirect fills it once
 * with the stored thread; the topic line says plainly who the window is
 * private with — `private conversation with @<handle>` — and the log region
 * carries the window's title (`dm/<handle>`, the way /query opened it). Plain
 * text typed here keeps the conversation going: it is prefixed with the
 * mention of the window's target unless it already names them, it always
 * goes out `direct`, and it answers the newest direct post the window shows,
 * so the reply threads onto the conversation the way a thread reply does.
 * The send itself is what src/state/postStatus does for every postable
 * window, and a status sent here while a `/dm` ran is echoed into this same
 * window by src/commands/defs/dm.
 */

import type { JSX } from 'react';

import { useDirect } from './useDirect';
import type { Status } from '../../api/schemas/status';
import type { Buffer } from '../../state/buffer';
import type { Draft } from '../../state/draft';
import { postStatus } from '../../state/postStatus';
import { bufferFor } from '../../state/selectors';
import { useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';

/** The handle to mention, `@<target>`; '' for a window with nothing to target. */
function mentionOf(target: string | null): string {
  return target === null ? '' : `@${target}`;
}

/** The newest direct post in {@link buffer}, what a DM window answers; null for none. */
function newestDirect(buffer: Buffer): Status | null {
  for (const line of buffer.lines.toReversed()) {
    if (line.kind === 'post' && line.status.visibility === 'direct') {
      return line.status;
    }
  }
  return null;
}

/** {@link draft}'s text with {@link mention} in front, unless it already carries it. */
function withMention(draft: Draft, mention: string): string {
  if (mention === '' || draft.text.toLowerCase().includes(mention.toLowerCase())) {
    return draft.text;
  }
  return `${mention} ${draft.text}`;
}

/** {@link draft} as the window says it: mentioning, direct, answering the thread. */
function directDraft(draft: Draft, mention: string, replyTo: Status | null): Draft {
  return {
    ...draft,
    text: withMention(draft, mention),
    visibility: 'direct',
    ...(replyTo === null ? {} : { inReplyToId: replyTo.id }),
  };
}

/** The DM window: its buffer's lines, filled once by ./useDirect. */
function DmWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useDirect(windowId);
  const win = useAppState().windows.windows.find((candidate) => candidate.id === windowId);
  return <BufferView windowId={windowId} label={win?.title ?? 'dm'} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'dm',
  topic: (window) => {
    const mention = mentionOf(window.ref.target);
    return mention === '' ? 'dm' : `private conversation with ${mention}`;
  },
  Component: DmWindow,
  onPost: async (draft, win, context) =>
    await postStatus(context, {
      accountKey: win.ref.accountKey,
      windowId: win.id,
      draft: directDraft(
        draft,
        mentionOf(win.ref.target),
        newestDirect(bufferFor(context.state, win.id)),
      ),
    }),
};
