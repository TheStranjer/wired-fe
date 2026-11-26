/**
 * The words a post's text box completes (WFE-302): the `@handles`, `#tags`
 * and `:emoji:` the command line completes (./completionProviders,
 * WFE-300) — handles also from the instance's search after a pause
 * (./useHandleSearch) — and the `[label` of a post of the {@link LabelSource}s
 * it is given, completed to the post's link (./postLabelProvider). There is
 * no provider for commands: a `/` in a post is text. The caret lives here
 * because the search needs the word it is in, and the box that steers the
 * completion (src/keys/useTextCompletion) needs the same caret.
 */

import { useState } from 'react';

import {
  type CompletionProvider,
  emojiProvider,
  handleProvider,
  tagProvider,
} from './completionProviders';
import { type LabelSource, postLabelProvider } from './postLabelProvider';
import { useCustomEmojis } from './useCustomEmojis';
import { handleWordAt, useHandleSearch } from './useHandleSearch';
import { useAppState } from '../state/StateContext';

/** The providers of a text box, and the caret of the box they answer for. */
type PostProviders = {
  readonly providers: readonly CompletionProvider[];
  readonly caret: number;
  readonly setCaret: (caret: number) => void;
};

/** A word that starts like an emoji: a `:` and something after it. */
const EMOJI_WORD = /(?:^|\s):\S/u;

/**
 * The providers for a box holding {@link text}, offering the labels of
 * {@link sources}. The instance's custom emoji are asked for once the text
 * holds a word that starts like an emoji (and stay asked for while a Tab
 * completion writes it out), not for every box that is merely on screen.
 */
export function usePostProviders(text: string, sources: readonly LabelSource[]): PostProviders {
  const state = useAppState();
  const [caret, setCaret] = useState(0);
  const searched = useHandleSearch(handleWordAt(text, caret));
  const typingEmoji = EMOJI_WORD.test(text);
  const emojis = useCustomEmojis(typingEmoji ? state.activeAccountKey : null);
  return {
    providers: [
      postLabelProvider(sources),
      handleProvider(state, searched),
      tagProvider(state),
      emojiProvider(emojis),
    ],
    caret,
    setCaret,
  };
}
