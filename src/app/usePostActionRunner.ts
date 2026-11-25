/**
 * Carries out a card's action as the command line would (decision 6, WFE-209):
 * a line that only fills the input goes through the same fill the prefill
 * hotkeys use, any other runs through the dispatcher. The runner is handed to
 * the app after every render so it always holds the newest context.
 */

import { useEffect } from 'react';
import type { RefObject } from 'react';

import { fillCommandLine, useCaretToEnd } from './hotkeyPrefill';
import { textHandler } from './useHotkeys';
import type { PostActionRunner } from './usePostActionsApi';
import { dispatchInput } from '../commands/dispatch';
import type { CommandContext } from '../commands/types';

/** Register a runner of card actions over {@link context} and {@link inputRef} with {@link register}. */
export function usePostActionRunner(
  inputRef: RefObject<HTMLInputElement | null>,
  context: CommandContext,
  register: (runner: PostActionRunner) => void,
): void {
  const askCaretToEnd = useCaretToEnd(inputRef);
  useEffect(() => {
    register(({ line, prefill }) => {
      if (prefill) {
        fillCommandLine(line, context, askCaretToEnd);
        return;
      }
      void dispatchInput(line, context, textHandler(context));
    });
  });
}
