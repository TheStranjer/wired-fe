/**
 * How a pane's title-bar buttons run a command line (WFE-228): focus the pane
 * the button belongs to, then hand the line to the post-action runner, as a
 * hotkey or a typed command would.
 */
import { useCallback } from 'react';

import { useAppDispatch } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';
import { usePostActions } from '../views/PostActionsContext';

/** A function that focuses pane `paneId`, then runs or fills a command line for it. */
export function useRunOnPane(paneId: string): (line: PostActionLine) => void {
  const dispatch = useAppDispatch();
  const { run } = usePostActions();
  return useCallback(
    (line) => {
      dispatch({ type: 'layout', action: { type: 'focusPane', paneId } });
      // React flushes the focus when the event ends, so by this microtask the
      // runner holds the state with this pane focused.
      queueMicrotask(() => {
        run(line);
      });
    },
    [dispatch, paneId, run],
  );
}
