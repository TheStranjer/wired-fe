/**
 * The global hotkeys wired to the app (decision 6, AGENTS.md "Two hotkey
 * modes"): the keymap is built once from the command registry, and the one
 * global keydown listener (src/keys) asks it what every chord means in the
 * keyboard's current mode. A mode chord moves the keyboard between insert and
 * navigation and carries the caret with it — navigation blurs the command
 * line, insert focuses it. A bound chord runs its command line through the
 * same dispatcher and the same text handler the command line itself uses, so
 * the hotkey and the typed command are one path. A prefill chord instead
 * fills its line into the command line for the user to finish, `{label}`
 * standing for the selected post's label. Bindings the keymap refused to
 * install are printed into the status window as `warn` lines once, on mount:
 * the shell boots and says what is missing.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import { type TextHandler, dispatchInput } from '../commands/dispatch';
import type { CommandContext } from '../commands/types';
import { decideKey } from '../keys/decide';
import { type Keymap, buildKeymap } from '../keys/keymap';
import type { InputMode } from '../keys/mode';
import { useGlobalKeys } from '../keys/useGlobalKeys';
import type { AppState } from '../state/appState';
import { labelForStatus, selectedStatus } from '../state/bufferSelection';
import { activeBuffer } from '../state/selectors';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The part of a prefill line that stands for the selected post's label. */
const LABEL_PLACEHOLDER = '{label}';

/** What a prefill prints when its line wants a label and nothing is selected. */
const NEED_SELECTION = 'Select a post first (j/k)';

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

/** The label the active window gave its selected post, or null while none stands there. */
function selectedLabel(state: AppState): string | null {
  const buffer = activeBuffer(state);
  const status = selectedStatus(buffer);
  return status === null ? null : labelForStatus(buffer, status.id);
}

/**
 * Fill {@link line} into the command line (AGENTS.md "prefill bindings") and
 * switch to insert mode: `{label}` becomes the selected post's label, and a
 * line that wants one with nothing selected prints {@link NEED_SELECTION} and
 * changes nothing. Else the line lands in the input with a trailing space —
 * {@link caretBehind} is asked for first, so the caret follows the text into
 * the render it brings about — and the user finishes it in insert mode.
 */
function fillCommandLine(
  line: string,
  context: CommandContext,
  caretBehind: (text: string) => void,
): void {
  let text = line;
  if (text.includes(LABEL_PLACEHOLDER)) {
    const label = selectedLabel(context.state);
    if (label === null) {
      context.print(NEED_SELECTION);
      return;
    }
    text = text.replaceAll(LABEL_PLACEHOLDER, label);
  }
  const filled = `${text} `;
  caretBehind(filled);
  context.setInput(filled);
  context.dispatch({ type: 'mode', mode: 'insert' });
}

/**
 * The caret handoff beside {@link moveCaret} (AGENTS.md "prefill bindings"):
 * the returned request names the text the command line is about to show, and
 * the effect carries out every request as soon as a commit puts that text in
 * {@link inputRef} — focusing the line and putting the caret behind it. While
 * no request stands, or none has come due yet, the effect does nothing.
 */
function useCaretToEnd(inputRef: RefObject<HTMLInputElement | null>): (text: string) => void {
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    const wanted = pendingRef.current;
    if (input === null || wanted === null) {
      return;
    }
    if (input.value !== wanted) {
      return;
    }
    pendingRef.current = null;
    placeCaret(input, wanted);
  });

  return (text: string): void => {
    const input = inputRef.current;
    if (input !== null && input.value === text) {
      placeCaret(input, text);
      return;
    }
    pendingRef.current = text;
  };
}

/** Focus the command line and put the caret behind {@link text}, its whole content. */
function placeCaret(input: HTMLInputElement, text: string): void {
  input.focus();
  input.setSelectionRange(text.length, text.length);
}

/**
 * Handle every global chord while the caller is mounted. {@link decideKey}
 * says what {@link chord} means in the mode the state holds: a mode change,
 * which dispatches `mode` and moves the caret (true); a bound command line,
 * which runs through the dispatcher exactly as if it had been typed (true); a
 * prefill line, which fills the command line, switches to insert mode and
 * carries the caret behind the new text (true); or nothing, which leaves the
 * key to type, focus and scroll as usual (false). {@link inputRef} is the
 * command line, so the modes and prefills can move the caret in it.
 */
export function useHotkeys(
  inputRef: RefObject<HTMLInputElement | null>,
  context: CommandContext,
): void {
  const keymap = useKeymap(context);
  const askCaretToEnd = useCaretToEnd(inputRef);

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
    if (decision.kind === 'prefill') {
      fillCommandLine(decision.line, context, askCaretToEnd);
      return true;
    }
    return false;
  });
}
