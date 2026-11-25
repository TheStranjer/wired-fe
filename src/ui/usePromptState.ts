/**
 * The state of a {@link PromptDialog} (WFE-269): the typed value, which
 * suggestion the arrows are on and whether the list is showing. Enter on a
 * suggestion, or a click on one, writes it into the field and hides the list
 * until the next edit; the arrows wrap and show it again. Enter on a field
 * with no suggestion in focus submits a non-blank value.
 */
import { useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

/** What the dialog reads and calls. */
export type PromptState = {
  readonly value: string;
  /** The suggestion the arrows are on, -1 for none. */
  readonly active: number;
  /** The suggestions on show: none while the list is hidden. */
  readonly words: readonly string[];
  /** A typed edit: shows the list again. */
  readonly type: (next: string) => void;
  /** Writes a suggestion into the field and hides the list. */
  readonly accept: (word: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

/** The index one {@link step} on from {@link from} in a list of {@link count}, wrapping; -1 when empty. */
function stepped(from: number, step: 1 | -1, count: number): number {
  if (count === 0) {
    return -1;
  }
  return (from + step + count + (from < 0 && step < 0 ? 1 : 0)) % count;
}

/** Who hears the prompt's edits and its answer. */
type PromptHandlers = {
  readonly onChange: ((value: string) => void) | undefined;
  readonly onSubmit: (value: string) => void;
};

/** The state of a prompt over the input {@link inputRef}, whose offered words are {@link offered}. */
export function usePromptState(
  inputRef: RefObject<HTMLInputElement | null>,
  offered: readonly string[],
  handlers: PromptHandlers,
): PromptState {
  const { onChange, onSubmit } = handlers;
  const [value, setValue] = useState('');
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(true);
  const words = open ? offered : [];

  const type = (next: string): void => {
    setValue(next);
    setActive(-1);
    setOpen(true);
    onChange?.(next);
  };
  const accept = (word: string): void => {
    type(word);
    setOpen(false);
    inputRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const word = words[active];
    if (event.key === 'Enter') {
      event.preventDefault();
      if (word !== undefined) {
        accept(word);
      } else if (value.trim() !== '') {
        onSubmit(value);
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(stepped(active, event.key === 'ArrowDown' ? 1 : -1, offered.length));
    }
  };
  return { value, active, words, type, accept, onKeyDown };
}
