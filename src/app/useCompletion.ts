/**
 * Tab on the command line (decision 6, WFE-124): the completion engine of
 * src/commands/complete replaces the word the caret sits in and cycles the
 * candidates it offered; this hook is its seam into the running app. While
 * the keyboard is in insert mode, Tab starts a completion or steps to the
 * next candidate and Shift+Tab steps back; any other key ends the completion
 * in progress, and a Tab with nothing to complete is left to the browser so
 * focus moves on. The completed line lands through the line's own setter and
 * the caret follows the text into the render it brings about, the way
 * ./useHotkeys carries it behind a prefill.
 */

import { useEffect, useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import {
  type CompletionState,
  type Provider,
  cycleCompletion,
  startCompletion,
} from '../commands/complete';
import type { InputModeState } from '../state/appState';

/** The chord that completes; pressed with Shift it steps back instead. */
const TAB = 'Tab';

/** What one Tab achieved: the new line, the new caret, and the state to cycle. */
type Showing = {
  readonly text: string;
  readonly cursor: number;
  readonly state: CompletionState;
};

/** The command line the hook steers: its element, its mode, text and owner. */
export type CompletionLine = {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly mode: InputModeState;
  readonly providers: readonly Provider[];
  readonly value: string;
  readonly setValue: (text: string) => void;
};

/** The handler to fold into the command line's onKeyDown. */
export type CompletionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => void;

/** Where the caret belongs once the command line shows the named text. */
type PendingCaret = {
  readonly text: string;
  readonly cursor: number;
};

/**
 * Carry the caret behind a completion: the returned ref names the text the
 * line is about to show and where inside it the caret belongs, and the effect
 * places it as soon as a commit puts that text into {@link inputRef}.
 */
function usePendingCaret(
  inputRef: RefObject<HTMLInputElement | null>,
): RefObject<PendingCaret | null> {
  const caretRef = useRef<PendingCaret | null>(null);

  useEffect(() => {
    const pending = caretRef.current;
    const input = inputRef.current;
    if (pending === null || input === null) {
      return;
    }
    if (input.value === pending.text) {
      caretRef.current = null;
      input.setSelectionRange(pending.cursor, pending.cursor);
    }
  });

  return caretRef;
}

/**
 * Steer {@link line} with Tab: keep which completion is in progress, answer
 * every keydown, and hand the command line the {@link CompletionKeyDown} to
 * put behind its input. A completion lives until any other key is pressed on
 * the line or the text it wrote is no longer what the line shows — then Tab
 * starts fresh instead of cycling back into stale text.
 */
export function useCompletion(line: CompletionLine): CompletionKeyDown {
  const { inputRef, mode, providers, value, setValue } = line;
  const activeRef = useRef<CompletionState | null>(null);
  const shownRef = useRef<string | null>(null);
  const caretRef = usePendingCaret(inputRef);

  function end(): void {
    activeRef.current = null;
    shownRef.current = null;
  }

  function show(showing: Showing): void {
    activeRef.current = showing.state;
    shownRef.current = showing.text;
    caretRef.current = { text: showing.text, cursor: showing.cursor };
    setValue(showing.text);
  }

  function start(event: KeyboardEvent<HTMLInputElement>): void {
    const caret = event.currentTarget.selectionStart ?? value.length;
    const showing = startCompletion(value, caret, providers);
    if (showing === null) {
      end();
      return;
    }
    show(showing);
    event.preventDefault();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== TAB) {
      end();
      return;
    }
    if (mode !== 'insert') {
      return;
    }
    const active = activeRef.current;
    if (shownRef.current === value && active !== null) {
      show(cycleCompletion(active, event.shiftKey ? -1 : 1));
      event.preventDefault();
      return;
    }
    start(event);
  }

  return onKeyDown;
}
