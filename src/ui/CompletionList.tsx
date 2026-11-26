/**
 * The live suggestion list above the command line (WFE-297): a listbox with
 * one option per suggested word, its name and a one-line description, and a
 * dim count of the rows that did not fit. The input keeps focus and names the
 * highlighted option through `aria-activedescendant`, so the options are not
 * in the tab order and a press on one does not take focus; a click picks it.
 * Generic: the rows are labels and descriptions, whatever provider made them.
 */
import type { JSX } from 'react';

import styles from './CompletionList.module.css';

/** The element id of option {@link index} of the list called {@link listId}. */
export function rowId(listId: string, index: number): string {
  return `${listId}-${String(index)}`;
}

/** One option: how it is named, what it is, and what a click on it does. */
export type CompletionRow = {
  readonly label: string;
  readonly description: string;
  readonly pick: () => void;
};

/** What the list shows. */
type CompletionListProps = {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly CompletionRow[];
  /** The highlighted row, -1 for none. */
  readonly active: number;
  /** Rows that did not fit, counted on a line after the list. */
  readonly more: number;
};

/** The suggestions as a listbox, hidden while there are none. */
export function CompletionList(props: CompletionListProps): JSX.Element {
  const { id, label, rows, active, more } = props;
  return (
    <div className={styles['popup']} hidden={rows.length === 0}>
      <div aria-label={label} className={styles['list']} id={id} role="listbox">
        {rows.map((row, index) => (
          <button
            aria-selected={index === active}
            className={index === active ? styles['chosen'] : styles['row']}
            id={rowId(id, index)}
            key={row.label}
            onClick={row.pick}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            role="option"
            tabIndex={-1}
            type="button"
          >
            <span className={styles['name']}>{row.label}</span>{' '}
            <span className={styles['summary']}>— {row.description}</span>
          </button>
        ))}
      </div>
      {more > 0 ? <div className={styles['more']}>+{String(more)} more</div> : null}
    </div>
  );
}
