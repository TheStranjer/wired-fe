/**
 * How the command line keeps or clears its text once a submitted line has run
 * (WFE-290): a line that ran is cleared, unless the run wrote the line itself
 * through `setInput` — a send the reader cancelled in the media review puts
 * their text back — in which case what it wrote stands. The same hook lends
 * the line to the app's restorer (WFE-284, ./useLineRestoreApi).
 */

import { useRef } from 'react';

import { type LineRestorer, useRegisterLineRestorer } from './useLineRestoreApi';

/** The setter handed to the command context, and the runner of one submitted line. */
export type LineWriter = {
  /** Replace the line's text; a run that does so is not cleared when it ends. */
  readonly setInput: (text: string) => void;
  /** Run {@link task}, then clear the line unless the task wrote it. */
  readonly settle: (task: () => Promise<void>) => Promise<void>;
};

/** The {@link LineWriter} over the line's text, registering its restorer with {@link register}. */
export function useLineWriter(
  line: { readonly value: string; readonly setValue: (text: string) => void },
  register: (restorer: LineRestorer) => void,
): LineWriter {
  const { setValue } = line;
  useRegisterLineRestorer(line, register);
  const rewrittenRef = useRef(false);
  // Read through a function: the flag changes during the awaited task, which
  // control-flow analysis cannot see.
  const rewritten = (): boolean => rewrittenRef.current;
  return {
    setInput: (text) => {
      rewrittenRef.current = true;
      setValue(text);
    },
    settle: async (task) => {
      rewrittenRef.current = false;
      await task();
      if (!rewritten()) {
        setValue('');
      }
    },
  };
}
