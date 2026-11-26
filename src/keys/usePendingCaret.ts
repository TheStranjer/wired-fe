/**
 * Carries the caret behind a completion in a text box (WFE-302): the text a
 * completion writes is shown by the next commit, and only then can the caret
 * be put behind it, so the box names the text it is about to show and where
 * inside it the caret belongs, and an effect does the rest.
 */

import { type RefObject, useEffect, useRef } from 'react';

/** The text a completed box is about to show, and where the caret goes in it. */
export type Written = {
  readonly text: string;
  readonly cursor: number;
};

/** What {@link usePendingCaret} lends: name where the caret goes, and focus the box. */
type CaretPlacer = {
  readonly place: (done: Written) => void;
  readonly focus: () => void;
};

/**
 * Carry the caret of {@link ref}'s box: {@link CaretPlacer.place} names the
 * text the box is about to show and where the caret belongs, and an effect puts
 * it there as soon as a commit puts that text into the box.
 */
export function usePendingCaret(ref: RefObject<HTMLTextAreaElement | null>): CaretPlacer {
  const pendingRef = useRef<Written | null>(null);
  useEffect(() => {
    const element = ref.current;
    const pending = pendingRef.current;
    if (pending !== null && element !== null && element.value === pending.text) {
      element.setSelectionRange(pending.cursor, pending.cursor);
      pendingRef.current = null;
    }
  });
  return {
    place: (done) => {
      pendingRef.current = done;
    },
    focus: () => {
      ref.current?.focus();
    },
  };
}
