/**
 * What saying something in a DM window means (WFE-108, WFE-207): the rule both
 * the command line and the window's docked input box post by. The text is
 * prefixed with the mention of the window's target unless it already names
 * them, it always goes out `direct`, and it answers the newest direct post the
 * window shows, so the reply threads onto the conversation the way a thread
 * reply does. The send itself is what src/state/postStatus does for every
 * postable window.
 */

import type { Status } from '../../api/schemas/status';
import type { Buffer } from '../../state/buffer';
import type { Draft } from '../../state/draft';
import { postStatus } from '../../state/postStatus';
import { bufferFor } from '../../state/selectors';
import type { PostContext } from '../../state/windowKind';
import type { WindowState } from '../../windows/model';

/** The handle to mention, `@<target>`; '' for a window with nothing to target. */
export function mentionOf(target: string | null): string {
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

/**
 * Posts {@link draft} into DM window {@link win} as that window says it, and
 * resolves to the message to show the reader, or to null when the post went
 * through.
 */
export async function postDirect(
  draft: Draft,
  win: WindowState,
  context: PostContext,
): Promise<string | null> {
  return await postStatus(context, {
    accountKey: win.ref.accountKey,
    windowId: win.id,
    draft: directDraft(
      draft,
      mentionOf(win.ref.target),
      newestDirect(bufferFor(context.state, win.id)),
    ),
  });
}
