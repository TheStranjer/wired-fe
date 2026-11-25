/**
 * The post actions the app lends to every card (decision 6, WFE-209): the lines
 * come from the registry the active account's backend can run, and running one
 * goes to whichever runner the command line registered. The command line owns
 * the context a line needs (the input, the caret), so it registers its runner
 * here after each render; until it does, running a line does nothing.
 */

import { useCallback, useMemo, useRef } from 'react';

import { useAvailableRegistry } from './useAvailableRegistry';
import { postActionLines } from '../commands/postActions';
import type { PostActionLine } from '../ui/postActionTypes';
import type { PostActions } from '../views/PostActionsContext';

/** Something that runs one card action. */
export type PostActionRunner = (line: PostActionLine) => void;

/** The actions to provide, and how the command line registers its runner. */
export function usePostActionsApi(): {
  readonly actions: PostActions;
  readonly register: (runner: PostActionRunner) => void;
} {
  const registry = useAvailableRegistry();
  const runner = useRef<PostActionRunner | null>(null);
  const register = useCallback((next: PostActionRunner) => {
    runner.current = next;
  }, []);
  const actions = useMemo<PostActions>(
    () => ({
      linesFor: (label) => postActionLines(registry, label),
      run: (line) => {
        runner.current?.(line);
      },
    }),
    [registry],
  );
  return { actions, register };
}
