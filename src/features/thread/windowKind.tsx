/**
 * The `thread` window kind (AGENTS.md "Windows, like IRC buffers", WFE-104):
 * one post with its conversation around it, loaded once by ./useThread and
 * read top to bottom — ancestors, the post, replies. The log region and the
 * topic line carry the window's title (`thread/<label or id>`, the way
 * /thread opened it). Plain text typed here answers the window's target
 * post: src/state/replyDraft prefixes the respondents the answer must name,
 * keeps the audience and the content warning of the post answered, and
 * everything else the composer settled on the draft — a `/cw` warning, a
 * `/poll` — rides along. The send itself is what src/state/postStatus does
 * for every postable window.
 */

import type { JSX } from 'react';

import { useThread } from './useThread';
import type { Status } from '../../api/schemas/status';
import type { AppState } from '../../state/appState';
import type { Draft } from '../../state/draft';
import { postStatus } from '../../state/postStatus';
import { replyDraft } from '../../state/replyDraft';
import { accountByKey, bufferFor } from '../../state/selectors';
import { useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';
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

/** The reply {@link built} carries everything else {@link draft} settled on. */
function withUserFields(draft: Draft, built: Draft): Draft {
  return { ...built, ...draft, text: built.text };
}

/** The thread window: its buffer's lines, filled once by ./useThread. */
function ThreadWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useThread(windowId);
  const win = useAppState().windows.windows.find((candidate) => candidate.id === windowId);
  return <BufferView windowId={windowId} label={win?.title ?? 'thread'} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'thread',
  topic: (window) => window.title,
  Component: ThreadWindow,
  onPost: async (draft, win, context) => {
    const target = targetStatus(context.state, win);
    if (target === null) {
      return NOTHING_TO_ANSWER;
    }
    const own = accountByKey(context.state, win.ref.accountKey)?.handle ?? '';
    return await postStatus(context, {
      accountKey: win.ref.accountKey,
      windowId: win.id,
      draft: withUserFields(draft, replyDraft(target, own, draft.text)),
    });
  },
};
