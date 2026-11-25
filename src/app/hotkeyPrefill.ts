/**
 * Prefill bindings (AGENTS.md "prefill bindings"): a hotkey that fills its
 * command line into the input for the user to finish instead of running it.
 * The text fill with its `{label}` placeholder, and the caret handoff that
 * puts the caret behind the filled text once it has rendered. Split out of
 * ./useHotkeys, which decides when to use them.
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { CommandContext } from '../commands/types';
import type { AppState } from '../state/appState';
import { labelForStatus, selectedStatus } from '../state/bufferSelection';
import { activeBuffer } from '../state/selectors';

/** The part of a prefill line that stands for the selected post's label. */
const LABEL_PLACEHOLDER = '{label}';

/** What a prefill prints when its line wants a label and nothing is selected. */
const NEED_SELECTION = 'Select a post first (j/k)';

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
export function fillCommandLine(
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
 * The caret handoff (AGENTS.md "prefill bindings"): the returned request names
 * the text the command line is about to show, and the effect carries out every
 * request as soon as a commit puts that text in {@link inputRef} — focusing the
 * line and putting the caret behind it. While no request stands, or none has
 * come due yet, the effect does nothing.
 */
export function useCaretToEnd(
  inputRef: RefObject<HTMLInputElement | null>,
): (text: string) => void {
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
