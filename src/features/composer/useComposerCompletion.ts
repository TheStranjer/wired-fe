/**
 * Completion in the composer window's text (WFE-302): the `@handles`, `#tags`
 * and `:emoji:` of the command line and, typed with a `[`, the labels of every
 * window shown on the current desktop — each row names its window — completed
 * to the posts' links, so a post can point at what the reader is looking at.
 */

import { type TextCompletion, useTextCompletion } from '../../keys/useTextCompletion';
import { activeDesktop, bufferFor } from '../../state/selectors';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import type { LabelSource } from '../../views/postLabelProvider';
import { usePostProviders } from '../../views/usePostProviders';
import { shownPanes } from '../../windows/desktopPanes';

/** The completion of the text of composer window {@link windowId}, which holds {@link text}. */
export function useComposerCompletion(windowId: string, text: string): TextCompletion {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const visible = new Set(shownPanes(activeDesktop(state)).map((pane) => pane.windowId));
  const sources: readonly LabelSource[] = state.windows.windows
    .filter((win) => visible.has(win.id))
    .map((win) => ({ title: win.title, buffer: bufferFor(state, win.id) }));
  const posting = usePostProviders(text, sources);
  return useTextCompletion({
    text,
    setText: (typed) => {
      dispatch({ type: 'composerEdit', windowId, patch: { text: typed } });
    },
    ...posting,
  });
}
