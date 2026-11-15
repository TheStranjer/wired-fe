/**
 * The global hotkeys wired to the app (decision 6, AGENTS.md "Two hotkey
 * modes"): the keymap is built once from the command registry, and the one
 * global keydown listener (src/keys) asks it what every chord means in the
 * keyboard's current mode. A mode chord moves the keyboard between insert and
 * navigation and carries the caret with it — navigation blurs the command
 * line, insert focuses it. A bound chord runs its command line through the
 * same dispatcher and the same text handler the command line itself uses, so
 * the hotkey and the typed command are one path. Bindings the keymap refused
 * to install are printed into the status window as `warn` lines once, on
 * mount: the shell boots and says what is missing.
 */

import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';

import { type TextHandler, dispatchInput } from '../commands/dispatch';
import type { CommandContext } from '../commands/types';
import { decideKey } from '../keys/decide';
import { type Keymap, buildKeymap } from '../keys/keymap';
import type { InputMode } from '../keys/mode';
import { useGlobalKeys } from '../keys/useGlobalKeys';
import { STATUS_WINDOW_ID } from '../windows/model';

/**
 * What a line of plain text does wherever it was entered — Enter on the
 * command line, or a run that ends in text: post it through the active
 * window's kind, and print what the window answers when it refuses.
 */
export function textHandler(context: CommandContext): TextHandler {
  return async (text: string): Promise<void> => {
    const error = await context.post({ text });
    if (error !== null) {
      context.print(error, 'error');
    }
  };
}

/** The {@link context}'s keymap, built once; refused bindings warn in the status window on mount. */
function useKeymap(context: CommandContext): Keymap {
  const keymap = useMemo(() => buildKeymap(context.registry), [context.registry]);
  const dispatch = context.dispatch;

  useEffect(() => {
    for (const problem of keymap.problems) {
      dispatch({
        type: 'print',
        windowId: STATUS_WINDOW_ID,
        date: new Date(),
        level: 'warn',
        text: problem,
      });
    }
  }, [dispatch, keymap]);

  return keymap;
}

/** Carry the caret with the mode: navigation leaves the command line, insert returns to it. */
function moveCaret(mode: InputMode, inputRef: RefObject<HTMLInputElement | null>): void {
  if (mode === 'navigation') {
    inputRef.current?.blur();
  } else {
    inputRef.current?.focus();
  }
}

/**
 * Handle every global chord while the caller is mounted. {@link decideKey}
 * says what {@link chord} means in the mode the state holds: a mode change,
 * which dispatches `mode` and moves the caret (true); a bound command line,
 * which runs through the dispatcher exactly as if it had been typed (true);
 * or nothing, which leaves the key to type, focus and scroll as usual
 * (false). {@link inputRef} is the command line, so the modes can blur and
 * focus it.
 */
export function useHotkeys(
  inputRef: RefObject<HTMLInputElement | null>,
  context: CommandContext,
): void {
  const keymap = useKeymap(context);

  useGlobalKeys((chord) => {
    const decision = decideKey(context.state.mode, chord, keymap);
    if (decision.kind === 'mode') {
      context.dispatch({ type: 'mode', mode: decision.mode });
      moveCaret(decision.mode, inputRef);
      return true;
    }
    if (decision.kind === 'run') {
      void dispatchInput(decision.line, context, textHandler(context));
      return true;
    }
    return false;
  });
}
