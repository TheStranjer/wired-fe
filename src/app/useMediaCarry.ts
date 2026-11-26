/**
 * The command context's `carryMedia` (WFE-290): the one gate every post of the
 * command line goes through before it carries the pending media — plain text,
 * `/cw`, `/poll`, `/vis <word> <text>` through the context's `post`, and the
 * text after `/home` through src/commands/postIntoWindow. It reviews alt text
 * with the app's modal (src/views/MediaReviewContext), sends it
 * (./pendingMedia), and when the reader cancels puts the line they typed back
 * on the command line, so nothing but the post is lost.
 */

import { withPendingMedia } from './pendingMedia';
import type { CommandContext } from '../commands/types';
import { currentMoment } from '../lib/time';
import { useRefreshDeps } from '../state/RefreshContext';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { useReviewMedia } from '../views/MediaReviewContext';

/** What the gate needs of the command line: its pending ids, its text and how to set it. */
type Line = {
  readonly pending: readonly string[];
  readonly text: string;
  readonly setInput: (text: string) => void;
};

/** The {@link CommandContext.carryMedia} of this render, for the command line {@link line}. */
export function useMediaCarry(line: Line): CommandContext['carryMedia'] {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const review = useReviewMedia();
  return async (draft) => {
    const context = { state, dispatch, now: currentMoment, refresh, review };
    const carried = await withPendingMedia(draft, line.pending, context);
    if (carried.kind === 'cancelled') {
      line.setInput(line.text);
    }
    return carried;
  };
}
