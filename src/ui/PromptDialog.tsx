/**
 * A small modal that asks for one line of text (WFE-269): a title, a labelled
 * input focused as it opens, `OK` and `Cancel`. Enter submits, Escape cancels
 * (the {@link Overlay} gives focus back to what held it), and a blank value
 * disables `OK`. Suggestions, when given, are a listbox under the field in the
 * WAI-ARIA combobox pattern: the arrows move through them and Enter (or a
 * click) puts the one in focus into the field. Presentational: where the
 * suggestions come from and what the answer does belong to the caller, which
 * hears every edit through `onChange` and answers with a new list.
 */
import { useId, useRef } from 'react';
import type { JSX } from 'react';

import { Overlay } from './Overlay';
import styles from './PromptDialog.module.css';
import { PromptField } from './PromptField';
import { SuggestionList } from './SuggestionList';
import { usePromptState } from './usePromptState';

/** What the dialog shows and reports. */
export type PromptDialogProps = {
  /** The dialog's accessible name and its visible heading, e.g. `Open profile`. */
  readonly title: string;
  /** The label of the input, e.g. `Pop out`. */
  readonly field: string;
  /** What the empty input hints at, e.g. `@user@instance`. */
  readonly placeholder: string;
  /** Words to offer under the input, best first; none when absent. */
  readonly suggestions?: readonly string[] | undefined;
  /** Called with the whole value after every edit, so the caller can refresh {@link suggestions}. */
  readonly onChange?: ((value: string) => void) | undefined;
  /** Called with the value, as typed, when `OK` or Enter submits a non-blank one. */
  readonly onSubmit: (value: string) => void;
  /** Called when `Cancel` or Escape dismisses the dialog. */
  readonly onCancel: () => void;
};

/** The dialog asking for one line of text. */
export function PromptDialog(props: PromptDialogProps): JSX.Element {
  const { title, field, placeholder, onSubmit, onCancel } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prompt = usePromptState(inputRef, props.suggestions ?? [], {
    onChange: props.onChange,
    onSubmit,
  });
  const listId = useId();
  const blank = prompt.value.trim() === '';

  return (
    <Overlay label={title} onClose={onCancel}>
      <div className={styles['form']}>
        <p className={styles['title']}>{title}</p>
        <PromptField
          field={field}
          inputRef={inputRef}
          listId={listId}
          placeholder={placeholder}
          prompt={prompt}
        />
        <SuggestionList
          active={prompt.active}
          id={listId}
          label={`${title} suggestions`}
          onPick={prompt.accept}
          words={prompt.words}
        />
        <div className={styles['actions']}>
          <button
            className={styles['button']}
            disabled={blank}
            onClick={() => {
              onSubmit(prompt.value);
            }}
            type="button"
          >
            OK
          </button>
          <button className={styles['button']} onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </div>
    </Overlay>
  );
}
