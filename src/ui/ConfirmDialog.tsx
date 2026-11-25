/**
 * A yes/no question in the modal box (WFE-266): a title, a message and two
 * buttons. Cancel comes first so the box's focus lands on it and a stray Enter
 * destroys nothing; Escape cancels too. `danger` styles the confirm button with
 * the theme's error colour. Presentational: what confirming does belongs to
 * the caller, and so does closing the dialog afterwards.
 */
import type { JSX } from 'react';

import styles from './ConfirmDialog.module.css';
import { Overlay } from './Overlay';

/** What the dialog asks and what its answers do. */
export type ConfirmDialogProps = {
  /** The question, e.g. `Delete post [a4]?`; also the dialog's accessible name. */
  readonly title: string;
  /** What the answer means, shown under the title. */
  readonly message: string;
  /** The words on the confirm button, e.g. `Delete`. */
  readonly confirmLabel: string;
  /** The words on the cancel button; `Cancel` when absent. */
  readonly cancelLabel?: string;
  /** Whether confirming is destructive: the confirm button turns error-coloured. */
  readonly danger?: boolean;
  /** Called when the confirm button is pressed. */
  readonly onConfirm: () => void;
  /** Called by the cancel button and by Escape. */
  readonly onCancel: () => void;
};

/** A modal confirmation with focus on its cancel button. */
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const { title, message, confirmLabel, cancelLabel = 'Cancel', danger = false } = props;
  return (
    <Overlay label={title} onClose={props.onCancel}>
      <h2 className={styles['title']}>{title}</h2>
      <p className={styles['message']}>{message}</p>
      <div className={styles['buttons']}>
        <button
          className={styles['button']}
          onClick={() => {
            props.onCancel();
          }}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          className={[styles['button'], danger ? styles['danger'] : undefined].join(' ')}
          onClick={() => {
            props.onConfirm();
          }}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}
