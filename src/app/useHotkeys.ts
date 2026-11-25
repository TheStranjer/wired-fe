/**
 * The global hotkeys wired to the app (decision 6, AGENTS.md "Two hotkey
 * modes"): the keymap is built from the command registry and rebuilt whenever
 * the reader rebinds a key (`/bind`, WFE-130), and the one global keydown
 * listener (src/keys) asks it what every chord means in the keyboard's current
 * mode. A mode chord moves the keyboard between insert and
 * navigation and carries the caret with it — navigation blurs the command
 * line, insert focuses it. A bound chord runs its command line through the
 * same dispatcher and the same text handler the command line itself uses, so
 * the hotkey and the typed command are one path. A prefill chord instead
 * fills its line into the command line for the user to finish, `{label}`
 * standing for the selected post's label (./hotkeyPrefill). A binding may be a
 * sequence of chords (decision 18): the first chord of one waits as the
 * pending prefix, and the next chord completes it or cancels it. Keys pressed
 * inside an open modal dialog never reach the keymap: the dialog owns them
 * (WFE-125). Bindings the keymap refused to install are printed into the
 * status window as `warn` lines once, on mount: the shell boots and says what
 * is missing.
 */

import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';

import { fillCommandLine, useCaretToEnd } from './hotkeyPrefill';
import { type TextHandler, dispatchInput } from '../commands/dispatch';
import type { CommandContext, Keymap } from '../commands/types';
import { type KeyDecision, continueKey, decideKey } from '../keys/decide';
import { buildKeymap } from '../keys/keymap';
import type { InputMode } from '../keys/mode';
import { type PendingKeys, useGlobalKeys } from '../keys/useGlobalKeys';
import { printAction } from '../state/appState';
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

/** The {@link context}'s keymap: registry defaults with the reader's overrides; refused bindings warn in the status window on mount. */
function useKeymap(context: CommandContext): Keymap {
  const overrides = context.state.settings.keyOverrides;
  const keymap = useMemo(
    () => buildKeymap(context.registry, overrides),
    [context.registry, overrides],
  );
  const dispatch = context.dispatch;

  useEffect(() => {
    for (const problem of keymap.problems) {
      dispatch(printAction(STATUS_WINDOW_ID, 'warn', problem));
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

/** What carrying out a decision touches: the command line, the app and the pending prefix. */
type Env = {
  readonly context: CommandContext;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly pending: PendingKeys;
  readonly askCaretToEnd: (text: string) => void;
};

/**
 * Carry out {@link decision}; true when the chord was used up. A mode change
 * dispatches `mode` and moves the caret; a run goes through the dispatcher
 * exactly as if it had been typed; a prefill fills the command line, switches
 * to insert mode and carries the caret behind the new text; a pending prefix
 * waits for the next chord; a cancel only ends the wait; nothing leaves the key
 * to type, focus and scroll as usual.
 */
function perform(decision: KeyDecision, env: Env): boolean {
  const { context, inputRef, pending, askCaretToEnd } = env;
  switch (decision.kind) {
    case 'mode':
      context.dispatch({ type: 'mode', mode: decision.mode });
      moveCaret(decision.mode, inputRef);
      return true;
    case 'run':
      void dispatchInput(decision.line, context, textHandler(context));
      return true;
    case 'prefill':
      fillCommandLine(decision.line, context, askCaretToEnd);
      return true;
    case 'pending':
      pending.setPrefix(decision.prefix);
      return true;
    case 'cancel':
      return true;
    case 'none':
      return false;
  }
}

/**
 * Handle every global chord while the caller is mounted. With no prefix
 * pending, {@link decideKey} says what the chord means in the mode the state
 * holds; with one, {@link continueKey} says whether it completes the sequence
 * or cancels it. Whatever the chord does, the wait for the rest of a sequence
 * ends first; a decision that starts a new wait sets it again.
 * {@link inputRef} is the command line, so the modes and prefills can move the
 * caret in it, and {@link pending} is the prefix the status line shows. A
 * chord pressed inside an open modal dialog is always left alone: the dialog
 * owns its keys (WFE-125).
 */
export function useHotkeys(
  inputRef: RefObject<HTMLInputElement | null>,
  context: CommandContext,
  pending: PendingKeys,
): void {
  const keymap = useKeymap(context);
  const askCaretToEnd = useCaretToEnd(inputRef);

  useGlobalKeys((chord) => {
    const { mode } = context.state;
    const { prefix } = pending;
    const decision =
      prefix === null ? decideKey(mode, chord, keymap) : continueKey(keymap[mode], prefix, chord);
    if (prefix !== null) {
      pending.setPrefix(null);
    }
    return perform(decision, { context, inputRef, pending, askCaretToEnd });
  });
}
