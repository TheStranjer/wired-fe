/**
 * The listbox under a {@link PromptDialog}'s field (WFE-269): one option per
 * suggested word. The input keeps focus and names the option the arrows are
 * on through `aria-activedescendant`, so the options are not in the tab order;
 * a click takes one.
 */
import type { JSX } from 'react';

import styles from './PromptDialog.module.css';

/** The element id of option {@link index} of the list called {@link listId}. */
export function optionId(listId: string, index: number): string {
  return `${listId}-${String(index)}`;
}

/** What the list shows and reports. */
type SuggestionListProps = {
  readonly id: string;
  readonly label: string;
  readonly words: readonly string[];
  /** The option the arrows are on, -1 for none. */
  readonly active: number;
  readonly onPick: (word: string) => void;
};

/** The suggestions as a listbox, hidden while there are none. */
export function SuggestionList(props: SuggestionListProps): JSX.Element {
  const { id, label, words, active, onPick } = props;
  return (
    <div
      aria-label={label}
      className={styles['list']}
      hidden={words.length === 0}
      id={id}
      role="listbox"
    >
      {words.map((word, index) => (
        <button
          aria-selected={index === active}
          className={index === active ? styles['chosen'] : styles['option']}
          id={optionId(id, index)}
          key={word}
          onClick={() => {
            onPick(word);
          }}
          role="option"
          tabIndex={-1}
          type="button"
        >
          {word}
        </button>
      ))}
    </div>
  );
}
