/**
 * Completion in a text box that holds a post (WFE-302): the engine of
 * src/commands/complete and the rows of src/commands/suggest, steered the way
 * the command line steers them but for a `<textarea>` and with one difference
 * that keeps the keyboard from being trapped there: Tab completes and cycles
 * only while a list of suggestions is showing — otherwise it moves focus on —
 * and Escape closes the list without leaving the box. Enter is not this
 * hook's: sending belongs to the box, whether or not the list is open.
 * Completion is Tab or a click on a row. The word at the caret is found
 * across newlines. The hook owns the box's ref, so the completed text can put
 * the caret behind itself; the caret is the owner's to keep (the providers
 * that search the instance for a handle need it too).
 */

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import { type Written, usePendingCaret } from './usePendingCaret';
import {
  type CompletionState,
  type Provider,
  cycleCompletion,
  startCompletion,
} from '../commands/complete';
import { type SuggestionView, suggestionView } from '../commands/suggest';

/** The keys that change no text and so leave a completion in progress alone. */
const MODIFIERS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/** What the box is given: its text and where the caret is in it, and the words that complete. */
type TextCompletionArgs = {
  readonly text: string;
  readonly setText: (text: string) => void;
  readonly caret: number;
  readonly setCaret: (caret: number) => void;
  readonly providers: readonly Provider[];
};

/** One row of the list: how it is named, what it says, its picture if it has one, and what a click does. */
type TextRow = {
  readonly label: string;
  readonly description: string;
  readonly image?: string | undefined;
  readonly pick: () => void;
};

/** What the box wires to its textarea and draws. */
export type TextCompletion = {
  /** The textarea's ref; the box puts it on the element. */
  readonly ref: RefObject<HTMLTextAreaElement | null>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Tell the hook the caret may have moved: after an edit, a key release or a click. */
  readonly onCaret: (element: HTMLTextAreaElement) => void;
  /** The element id the list is to carry. */
  readonly listId: string;
  /** The rows to list; none while no list shows. */
  readonly rows: readonly TextRow[];
  /** Rows that did not fit. */
  readonly more: number;
  /** The highlighted row, -1 for none. */
  readonly active: number;
};

/** What one Tab achieved: the new text and caret, and the state to cycle. */
type Showing = {
  readonly text: string;
  readonly cursor: number;
  readonly state: CompletionState;
};

/** The text and caret the list was closed on: it stays closed until either changes. */
type Closed = {
  readonly text: string;
  readonly caret: number;
};

/** What the list shows for the word at the caret, and what ends or closes it. */
type Suggestions = {
  readonly view: SuggestionView | null;
  readonly completing: CompletionState | null;
  readonly setShown: (showing: Showing | null) => void;
  readonly setClosed: (closed: Closed) => void;
};

/**
 * The suggestions for {@link args}: they follow a Tab completion in progress
 * while the box still shows what it wrote, and stay closed after Escape until
 * the text or the caret moves.
 */
function useSuggestions(args: TextCompletionArgs): Suggestions {
  const { text, caret, providers } = args;
  const [shown, setShown] = useState<Showing | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  const completing = shown !== null && shown.text === text ? shown.state : null;
  const isClosed = closed !== null && closed.text === text && closed.caret === caret;
  const view = isClosed ? null : suggestionView({ text, cursor: caret }, providers, completing);
  return { view, completing, setShown, setClosed };
}

/** The rows of {@link view}, each completing through {@link complete}. */
function rowsOf(
  view: SuggestionView | null,
  complete: (done: Written) => void,
): readonly TextRow[] {
  return view === null
    ? []
    : view.rows.map((row) => ({
        label: row.label,
        description: row.description,
        image: row.image,
        pick: () => {
          complete(view.pick(row.word));
        },
      }));
}

/** What Tab shows next in {@link element}: the first candidate, or the next one of the completion in progress. */
function nextShowing(
  args: TextCompletionArgs,
  completing: CompletionState | null,
  event: KeyboardEvent<HTMLTextAreaElement>,
): Showing | null {
  return completing === null
    ? startCompletion(args.text, event.currentTarget.selectionStart, args.providers)
    : cycleCompletion(completing, event.shiftKey ? -1 : 1);
}

/** Steer a text box with Tab and give it the suggestion rows for the word at its caret. */
export function useTextCompletion(args: TextCompletionArgs): TextCompletion {
  const { text, setText, setCaret } = args;
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const { place, focus } = usePendingCaret(ref);
  const { view, completing, setShown, setClosed } = useSuggestions(args);

  function write(done: Written): void {
    place(done);
    setText(done.text);
    setCaret(done.cursor);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Tab') {
      const next = view === null ? null : nextShowing(args, completing, event);
      if (next !== null) {
        event.preventDefault();
        write(next);
        setShown(next);
      }
    } else if (!MODIFIERS.has(event.key)) {
      if (event.key === 'Escape' && view !== null) {
        event.preventDefault();
        setClosed({ text, caret: event.currentTarget.selectionStart });
      }
      setShown(null);
    }
  }

  return {
    ref,
    onKeyDown,
    onCaret: (element) => {
      setCaret(element.selectionStart);
    },
    listId,
    rows: rowsOf(view, (done) => {
      write(done);
      setShown(null);
      focus();
    }),
    more: view?.more ?? 0,
    active: view?.active ?? -1,
  };
}
