/**
 * The way back to the command line for what the app layer cannot send (WFE-284):
 * the account picker gives a draft's text back when it is cancelled or its post
 * fails. The command line owns its text, so it registers a restorer here after
 * each render; until it does, nothing is restored. The same shape as
 * ./useLineRunnerApi. A restorer fills the line only when it is empty, so what
 * the reader typed meanwhile is never overwritten.
 */

import { useCallback, useEffect, useRef } from 'react';

/** Puts text on the command line when it is empty; answers whether it did. */
export type LineRestorer = (text: string) => boolean;

/** The restorer to lend, and how the command line registers its own. */
export function useLineRestoreApi(): {
  readonly restore: LineRestorer;
  readonly register: (restorer: LineRestorer) => void;
} {
  const restorerRef = useRef<LineRestorer | null>(null);
  const register = useCallback((next: LineRestorer) => {
    restorerRef.current = next;
  }, []);
  const restore = useCallback<LineRestorer>((text) => restorerRef.current?.(text) ?? false, []);
  return { restore, register };
}

/** Register a restorer over the line's {@link value} and {@link setValue} with {@link register}, after every render. */
export function useRegisterLineRestorer(
  line: { readonly value: string; readonly setValue: (text: string) => void },
  register: (restorer: LineRestorer) => void,
): void {
  const { value, setValue } = line;
  useEffect(() => {
    register((text) => {
      if (value !== '') {
        return false;
      }
      setValue(text);
      return true;
    });
  });
}
