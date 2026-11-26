/**
 * The modal that shows every attachment of a send with its alt text, or the
 * lack of it, before the send goes out (WFE-290): a row per attachment — the
 * thumbnail, the file's name and a textarea labelled `Description for <file>` —
 * with the rows that have none marked by a `no description` tag as well as
 * `aria-invalid`, so colour is never the only sign. Focus opens on the first
 * row without a description. `Submit`, and Enter in a textarea (Shift+Enter
 * adds a line), hand every description typed back; `Cancel` and Escape hand
 * the same back, so what was typed is not lost. Empty descriptions are allowed:
 * the box never blocks. The list scrolls inside the box. Presentational: what
 * the answers mean, and closing the box, belong to the caller.
 */
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';

import styles from './MediaReviewDialog.module.css';
import { Overlay } from './Overlay';

/** The description of each line by its key. */
type Descriptions = ReadonlyMap<string, string>;

/**
 * One attachment as the dialog needs it: the key its description is answered
 * under, the file's name, a thumbnail when it has one, and the description it
 * has now. The app's media lines fit it as they are.
 */
export type ReviewItem = {
  readonly key: string;
  readonly name: string;
  readonly previewUrl: string | null;
  readonly description: string;
};

/** What the dialog shows and reports. */
export type MediaReviewDialogProps = {
  /** Every attachment of the send, in order. */
  readonly items: readonly ReviewItem[];
  /** Called with the description of every line by its key, by `Submit` and by Enter. */
  readonly onSubmit: (descriptions: Descriptions) => void;
  /** Called by `Cancel` and by Escape, with what was typed so far. */
  readonly onCancel: (descriptions: Descriptions) => void;
};

/** Focus the first description in {@link list} that is empty, once the box has put focus on its first field. */
function useFirstMissingFocus(list: { readonly current: HTMLUListElement | null }): void {
  // A layout effect of the component that renders the Overlay: it runs after
  // the Overlay's own, which focuses the first field, so this wins.
  useLayoutEffect(() => {
    list.current?.querySelector<HTMLTextAreaElement>('textarea[aria-invalid="true"]')?.focus();
  }, [list]);
}

/** One attachment: thumbnail, name, the tag when it has no description, and the textarea. */
function ReviewRow(props: {
  readonly item: ReviewItem;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onEnter: () => void;
}): JSX.Element {
  const { item, value, onChange, onEnter } = props;
  const missing = value.trim() === '';
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onEnter();
    }
  };
  return (
    <li className={styles['row']}>
      {item.previewUrl === null ? (
        <span aria-hidden="true" className={styles['thumb']} />
      ) : (
        <img
          alt=""
          className={styles['thumb']}
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={item.previewUrl}
        />
      )}
      <div className={styles['fields']}>
        <span className={styles['name']}>{item.name}</span>
        {missing ? <span className={styles['missing']}>no description</span> : null}
        <textarea
          aria-invalid={missing}
          aria-label={`Description for ${item.name}`}
          className={styles['description']}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
          rows={2}
          value={value}
        />
      </div>
    </li>
  );
}

/** One row of the dialog: the line and the description typed for it so far. */
type Row = { readonly item: ReviewItem; readonly value: string };

/** `Cancel`, which never submits, then `Submit`, which does. */
function ReviewButtons(props: { readonly onCancel: () => void }): JSX.Element {
  return (
    <div className={styles['buttons']}>
      <button className={styles['button']} onClick={props.onCancel} type="button">
        Cancel
      </button>
      <button className={styles['button']} type="submit">
        Submit
      </button>
    </div>
  );
}

/** The dialog that reviews the alt text of {@link MediaReviewDialogProps.items}. */
export function MediaReviewDialog(props: MediaReviewDialogProps): JSX.Element {
  const { items, onSubmit, onCancel } = props;
  const [rows, setRows] = useState<readonly Row[]>(() =>
    items.map((item) => ({ item, value: item.description })),
  );
  const listRef = useRef<HTMLUListElement | null>(null);
  const descriptionId = useId();
  useFirstMissingFocus(listRef);
  const missing = items.filter((item) => item.description.trim() === '').length;
  const typed = (): Descriptions => new Map(rows.map((row) => [row.item.key, row.value]));
  const submit = (): void => {
    onSubmit(typed());
  };
  const cancel = (): void => {
    onCancel(typed());
  };
  return (
    <Overlay describedBy={descriptionId} label="Describe media" onClose={cancel} size="wide">
      <form
        className={styles['form']}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2 className={styles['title']}>Describe media</h2>
        <p className={styles['summary']} id={descriptionId}>
          {`${String(missing)} of ${String(items.length)} attachments have no description`}
        </p>
        <ul aria-label="Attachments" className={styles['list']} ref={listRef}>
          {rows.map((row) => (
            <ReviewRow
              item={row.item}
              key={row.item.key}
              onChange={(value) => {
                setRows((current) =>
                  current.map((one) => (one.item.key === row.item.key ? { ...one, value } : one)),
                );
              }}
              onEnter={submit}
              value={row.value}
            />
          ))}
        </ul>
        <ReviewButtons onCancel={cancel} />
      </form>
    </Overlay>
  );
}
