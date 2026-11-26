/**
 * The command line at the bottom of the screen: a prompt and one text input
 * (AGENTS.md "The command line is the composer"). Presentational only:
 * parsing, history and completion belong to higher layers.
 */
import type { ChangeEvent, JSX, KeyboardEvent, ReactNode, Ref } from 'react';

import styles from './InputLine.module.css';

/** What the command line shows and the callbacks it drives. */
export type InputLineProps = {
  /** Prompt prefix, e.g. the active account followed by ">". */
  readonly prompt: string;
  /** The current text; the parent owns it and clears it after a submit. */
  readonly value: string;
  /** Called with the full text whenever it changes. */
  readonly onChange: (value: string) => void;
  /** Called with the text when Enter is pressed on a non-blank line, or on any line when {@link allowEmpty}. */
  readonly onSubmit: (value: string) => void;
  /** Lets Enter submit a blank line, e.g. when media wait to be posted (WFE-293). */
  readonly allowEmpty?: boolean;
  /** Called when the input gains focus (AGENTS.md "Two hotkey modes": focusing leaves navigation). */
  readonly onFocus?: () => void;
  /** Called on every keydown before the line's own Enter handling; a handler
   * that prevents the event's default swallows the key, Enter included. */
  readonly onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Forwarded to the input so the parent can focus it. */
  readonly inputRef?: Ref<HTMLInputElement>;
  /** Something at the left edge before the prompt, e.g. the attach button (WFE-287). */
  readonly lead?: ReactNode;
};

/** A single-line composer styled after an IRC input. */
export function InputLine(props: InputLineProps): JSX.Element {
  const { prompt, value, onChange, onSubmit, onFocus, onKeyDown, inputRef, lead, allowEmpty } =
    props;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    onKeyDown?.(event);
    const submittable = allowEmpty === true || value.trim() !== '';
    if (event.key === 'Enter' && !event.defaultPrevented && submittable) {
      event.preventDefault();
      onSubmit(value);
    }
  }

  return (
    <div className={styles['container']}>
      {lead}
      <span aria-hidden="true" className={styles['prompt']}>
        {prompt}
      </span>
      <input
        aria-label="Command line"
        autoComplete="off"
        className={styles['input']}
        onChange={handleChange}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        spellCheck={false}
        type="text"
        value={value}
      />
    </div>
  );
}
