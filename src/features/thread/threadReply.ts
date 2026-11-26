/**
 * What saying something in a thread window means (WFE-104, WFE-286): the rule
 * both the command line's plain text and the window's docked input box reply
 * by. The text answers the window's target post: src/state/replyDraft prefixes
 * the respondents the answer must name, keeps the audience and the content
 * warning of the post answered, and everything else the draft settled on — a
 * `/cw` warning, a `/vis`, a `/poll` — wins over those defaults. The send
 * itself is what src/state/postStatus does for every postable window.
 */

import type { Status } from '../../api/schemas/status';
import type { AppState } from '../../state/appState';
import type { ComposerFields, Draft } from '../../state/draft';
import { postStatus } from '../../state/postStatus';
import { replyDraft } from '../../state/replyDraft';
import { accountByKey, bufferFor } from '../../state/selectors';
import type { PostContext } from '../../state/windowKind';
import type { WindowState } from '../../windows/model';

/** What the thread window says when it has no target post to answer. */
const NOTHING_TO_ANSWER = 'Nothing to reply to in this window';

/** The window's target status, as its scrollback shows it; null when absent. */
function targetStatus(state: AppState, win: WindowState): Status | null {
  const { target } = win.ref;
  if (target === null) {
    return null;
  }
  for (const line of bufferFor(state, win.id).lines) {
    if (line.kind === 'post' && line.status.id === target) {
      return line.status;
    }
  }
  return null;
}

/** The handle of the account {@link win} posts as; '' when it has none. */
function ownHandle(state: AppState, win: WindowState): string {
  return accountByKey(state, win.ref.accountKey)?.handle ?? '';
}

/** The reply {@link built} carries everything else {@link draft} settled on. */
function withUserFields(draft: Draft, built: Draft): Draft {
  return { ...built, ...draft, text: built.text };
}

/**
 * The fields an empty reply box starts from: the audience and the content
 * warning of the post answered, the reader's default audience where the post
 * leaves it open. Null while the window's target post is not on show.
 */
export function replyDefaults(state: AppState, win: WindowState): ComposerFields | null {
  const target = targetStatus(state, win);
  if (target === null) {
    return null;
  }
  const answer = replyDraft(target, ownHandle(state, win), '');
  return {
    text: '',
    spoiler: target.spoiler_text,
    visibility: answer.visibility ?? state.settings.defaultVisibility,
  };
}

/**
 * Posts {@link draft} into thread window {@link win} as a reply to its target,
 * and resolves to the message to show the reader, or to null when the post
 * went through.
 */
export async function postReply(
  draft: Draft,
  win: WindowState,
  context: PostContext,
): Promise<string | null> {
  const target = targetStatus(context.state, win);
  if (target === null) {
    return NOTHING_TO_ANSWER;
  }
  return await postStatus(context, {
    accountKey: win.ref.accountKey,
    windowId: win.id,
    draft: withUserFields(draft, replyDraft(target, ownHandle(context.state, win), draft.text)),
  });
}
