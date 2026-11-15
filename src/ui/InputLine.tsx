/**
 * The command line at the bottom of the screen: a prompt and one text input
 * (AGENTS.md "The command line is the composer"). Presentational only:
 * parsing, history and completion belong to higher layers.
 */
import type { ChangeEvent, JSX, KeyboardEvent, Ref } from 'react';

import styles from './InputLine.module.css';

/** What the command line shows and the callbacks it drives. */
export type InputLineProps = {
  /** Prompt prefix, e.g. the active account followed by ">". */
  readonly prompt: string;
  /** The current text; the parent owns it and clears it after a submit. */
  readonly value: string;
  /** Called with the full text whenever it changes. */
  readonly onChange: (value: string) => void;
  /** Called with the text when Enter is pressed on a non-blank line. */
  readonly onSubmit: (value: string) => void;
  /** Called when the input gains focus (AGENTS.md "Two hotkey modes": focusing leaves navigation). */
  readonly onFocus?: () => void;
  /** Forwarded to the input so the parent can focus it. */
  readonly inputRef?: Ref<HTMLInputElement>;
};

/** A single-line composer styled after an IRC input. */
export function InputLine(props: InputLineProps): JSX.Element {
  const { prompt, value, onChange, onSubmit, onFocus, inputRef } = props;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && value.trim() !== '') {
      event.preventDefault();
      onSubmit(value);
    }
  }

  return (
    <div className={styles['container']}>
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
