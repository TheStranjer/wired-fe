/**
 * The command line at the bottom of the screen: a prompt and one text input
 * (AGENTS.md "The command line is the composer"). Presentational only:
 * parsing, history and completion belong to higher layers. The input is the
 * combobox of the WAI-ARIA pattern (WFE-297): it keeps focus while the list
 * its parent draws above it, through {@link InputLineProps.popup}, offers
 * suggestions, and names the highlighted one with `aria-activedescendant`.
 */
import type { ChangeEvent, JSX, KeyboardEvent, ReactNode, Ref, SyntheticEvent } from 'react';

import styles from './InputLine.module.css';
import { useT } from '../i18n/I18nProvider';

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
  /** Called with the input after an edit, a key release or a click: the caret may have moved. */
  readonly onCaret?: (input: HTMLInputElement) => void;
  /** Forwarded to the input so the parent can focus it. */
  readonly inputRef?: Ref<HTMLInputElement>;
  /** Something at the left edge before the prompt, e.g. the attach button (WFE-287). */
  readonly lead?: ReactNode;
  /** Element id of the listbox the input controls. */
  readonly listId?: string;
  /** Whether that listbox has suggestions on show. */
  readonly expanded?: boolean;
  /** Element id of the option the list highlights. */
  readonly activeId?: string | undefined;
  /** The suggestion list, drawn above the line. */
  readonly popup?: ReactNode;
};

/** True when the keydown is an Enter nobody swallowed, on a line that may be submitted. */
function submits(
  event: KeyboardEvent<HTMLInputElement>,
  value: string,
  allowEmpty: boolean | undefined,
): boolean {
  const submittable = allowEmpty === true || value.trim() !== '';
  return event.key === 'Enter' && !event.defaultPrevented && submittable;
}

/** A single-line composer styled after an IRC input. */
export function InputLine(props: InputLineProps): JSX.Element {
  const { prompt, value, onChange, onSubmit, onFocus, onKeyDown, inputRef, lead, allowEmpty } =
    props;
  const { onCaret, listId, expanded, activeId, popup } = props;
  const t = useT();
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
    onCaret?.(event.target);
  }
  function reportCaret(event: SyntheticEvent<HTMLInputElement>): void {
    onCaret?.(event.currentTarget);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    onKeyDown?.(event);
    if (submits(event, value, allowEmpty)) {
      event.preventDefault();
      onSubmit(value);
    }
  }

  return (
    <div className={styles['container']}>
      {popup}
      {lead}
      <span aria-hidden="true" className={styles['prompt']}>
        {prompt}
      </span>
      <input
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={expanded}
        aria-label={t('ui.input_line.label')}
        autoComplete="off"
        className={styles['input']}
        onChange={handleChange}
        onClick={reportCaret}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        onKeyUp={reportCaret}
        ref={inputRef}
        role="combobox"
        spellCheck={false}
        type="text"
        value={value}
      />
    </div>
  );
}
