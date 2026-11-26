/**
 * The live suggestion list above the command line (WFE-297): a listbox with
 * one option per suggested word, its name and a one-line description. It
 * scrolls when there are more rows than fit (WFE-306), and keeps the
 * highlighted option in view. The input keeps focus and names the
 * highlighted option through `aria-activedescendant`, so the options are not
 * in the tab order and a press on one does not take focus; a click picks it.
 * A row may carry a detail (WFE-311): a tooltip on hover, and a dim strip below
 * the rows with the highlighted row's detail, which the option points at with
 * `aria-describedby`; hovering does not move the strip.
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
  /** More about it, as the row's tooltip and in the strip while it is highlighted; absent for none. */
  readonly detail?: string | undefined;
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

  const detail = rows[active]?.detail;
  const detailId = `${id}-detail`;

  return (
    <div className={styles['popup']} hidden={rows.length === 0}>
      <div aria-label={label} className={styles['list']} id={id} ref={listRef} role="listbox">
        {rows.map((row, index) => (
          <Option
            describedBy={index === active && detail !== undefined ? detailId : undefined}
            id={rowId(id, index)}
            key={`${row.label} ${row.description}`}
            row={row}
            selected={index === active}
          />
        ))}
      </div>
      {detail === undefined ? null : (
        <div className={styles['detail']} id={detailId}>
          {detail}
        </div>
      )}
    </div>
  );
}

/** What one option needs besides its row. */
type OptionProps = {
  readonly row: CompletionRow;
  readonly id: string;
  readonly selected: boolean;
  /** The id of the element that describes it (the detail strip); undefined for none. */
  readonly describedBy: string | undefined;
};

/** One option: its image, name and description, its detail as the tooltip. */
function Option(props: OptionProps): JSX.Element {
  const { row, id, selected, describedBy } = props;
  return (
    <button
      aria-describedby={describedBy}
      aria-selected={selected}
      className={selected ? styles['chosen'] : styles['row']}
      id={id}
      onClick={row.pick}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      role="option"
      tabIndex={-1}
      title={row.detail}
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
  );
}
