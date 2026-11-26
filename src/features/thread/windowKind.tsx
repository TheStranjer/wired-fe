/**
 * The `thread` window kind (AGENTS.md "Windows, like IRC buffers", WFE-104,
 * WFE-286): one post with its conversation around it, loaded once by
 * ./useThread and read top to bottom — ancestors, the post, replies. The log
 * region and the topic line carry the window's title (`thread/<label or id>`,
 * the way /thread opened it). Under the scrollback, outside the scrolling
 * area, sits a docked input box (./ThreadInput) that replies to the target
 * post and runs `/` lines as commands on this thread; a thread that failed to
 * load has no box. Files pasted or dropped onto the pane go to the box's own
 * media (WFE-289). Plain text typed at the command line answers the target
 * post too: ./threadReply prefixes the respondents the answer must name, keeps
 * the audience and the content warning of the post answered, and everything
 * else the composer settled on the draft — a `/cw` warning, a `/poll` — rides
 * along. The send itself is what src/state/postStatus does for every postable
 * window.
 */

import type { JSX } from 'react';

import { ThreadInput } from './ThreadInput';
import { postReply } from './threadReply';
import { useThread } from './useThread';
import { useT } from '../../i18n/I18nProvider';
import { bufferFor } from '../../state/selectors';
import { useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';
import { DockedInput } from '../../views/DockedInput';
import { useComposerMedia } from '../../views/useComposerMedia';

/** The thread window: its buffer's lines, filled once by ./useThread, over its docked box. */
function ThreadWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useThread(windowId);
  const state = useAppState();
  const win = state.windows.windows.find((candidate) => candidate.id === windowId);
  const failed = bufferFor(state, windowId).load === 'error';
  const media = useComposerMedia(windowId, win?.ref.accountKey ?? null);
  const logLabel = useT()('features.thread.log_label');
  return (
    <DockedInput
      input={win === undefined || failed ? null : <ThreadInput win={win} />}
      onFiles={media.add}
    >
      <BufferView windowId={windowId} label={win?.title ?? logLabel} />
    </DockedInput>
  );
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'thread',
  topic: (window) => window.title,
  Component: ThreadWindow,
  onPost: postReply,
};
