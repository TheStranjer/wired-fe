/**
 * Completion in a thread window's input box (WFE-302): the `@handles`,
 * `#tags` and `:emoji:` of the command line and, typed with a `[`, the labels
 * of this thread's own posts, completed to their links.
 */

import { type TextCompletion, useTextCompletion } from '../../keys/useTextCompletion';
import type { ComposerFields } from '../../state/draft';
import { bufferFor } from '../../state/selectors';
import { useAppState } from '../../state/StateContext';
import { usePostProviders } from '../../views/usePostProviders';
import type { WindowState } from '../../windows/model';

/** The completion of the box of thread window {@link win} over its {@link fields}. */
export function useThreadCompletion(
  win: WindowState,
  fields: ComposerFields,
  setFields: (fields: ComposerFields) => void,
): TextCompletion {
  const state = useAppState();
  const sources = [{ title: null, buffer: bufferFor(state, win.id) }];
  const posting = usePostProviders(fields.text, sources);
  return useTextCompletion({
    text: fields.text,
    setText: (text) => {
      setFields({ ...fields, text });
    },
    ...posting,
  });
}
