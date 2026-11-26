/**
 * The live suggestion list above the command line (WFE-297): a listbox with
 * one option per suggested word, its name and a one-line description. It
 * scrolls when there are more rows than fit (WFE-306), and keeps the
 * highlighted option in view. The input keeps focus and names the
 * highlighted option through `aria-activedescendant`, so the options are not
 * in the tab order and a press on one does not take focus; a click picks it.
 * Generic: the rows are labels and descriptions, whatever provider made them.
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

import styles from './CompletionList.module.css';

/** The element id of option {@link index} of the list called {@link listId}. */
export function rowId(listId: string, index: number): string {
  return `${listId}-${String(index)}`;
}

/** One option: how it is named, what it is, and what a click on it does. */
export type CompletionRow = {
  readonly label: string;
  /** One line about it; empty for none, and the row then shows no dash. */
  readonly description: string;
  /** The URL of a picture shown before the label, named by the label (an emoji). */
  readonly image?: string | undefined;
  readonly pick: () => void;
};

/** What the list shows. */
type CompletionListProps = {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly CompletionRow[];
  /** The highlighted row, -1 for none. */
  readonly active: number;
};

/** The suggestions as a listbox, hidden while there are none; it scrolls to the highlighted option. */
export function CompletionList(props: CompletionListProps): JSX.Element {
  const { id, label, rows, active } = props;
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const row = listRef.current?.children.item(active);
    // jsdom implements no scrollIntoView.
    if (row instanceof HTMLElement && 'scrollIntoView' in row) {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  return (
    <div className={styles['popup']} hidden={rows.length === 0}>
      <div aria-label={label} className={styles['list']} id={id} ref={listRef} role="listbox">
        {rows.map((row, index) => (
          <button
            aria-selected={index === active}
            className={index === active ? styles['chosen'] : styles['row']}
            id={rowId(id, index)}
            key={`${row.label} ${row.description}`}
            onClick={row.pick}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            role="option"
            tabIndex={-1}
            type="button"
          >
            {row.image === undefined ? null : (
              <img alt={row.label} className={styles['image']} draggable={false} src={row.image} />
            )}
            <span className={styles['name']}>{row.label}</span>
            {row.description === '' ? null : (
              <>
                {' '}
                <span className={styles['summary']}>— {row.description}</span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
