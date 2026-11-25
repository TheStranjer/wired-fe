/**
 * The labelled input of a {@link PromptDialog} (WFE-269), the combobox of the
 * WAI-ARIA pattern: it keeps focus while the arrows move through the
 * suggestion list it controls, and names the option in focus with
 * `aria-activedescendant`.
 */
import type { JSX, RefObject } from 'react';

import styles from './PromptDialog.module.css';
import { optionId } from './SuggestionList';
import type { PromptState } from './usePromptState';

/** What the field shows and where its state lives. */
type PromptFieldProps = {
  /** The label of the input, e.g. `Pop out`. */
  readonly field: string;
  readonly placeholder: string;
  /** Element id of the suggestion list the input controls. */
  readonly listId: string;
  readonly prompt: PromptState;
  readonly inputRef: RefObject<HTMLInputElement | null>;
};

/** The label and input of the prompt. */
export function PromptField(props: PromptFieldProps): JSX.Element {
  const { field, placeholder, listId, prompt, inputRef } = props;
  return (
    <label className={styles['label']}>
      {field}
      <input
        aria-activedescendant={prompt.active < 0 ? undefined : optionId(listId, prompt.active)}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={prompt.words.length > 0}
        autoComplete="off"
        className={styles['input']}
        onChange={(event) => {
          prompt.type(event.target.value);
        }}
        onKeyDown={prompt.onKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        spellCheck={false}
        type="text"
        value={prompt.value}
      />
    </label>
  );
}
