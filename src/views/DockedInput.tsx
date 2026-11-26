/**
 * The layout of a window with an input box docked under its scrollback
 * (WFE-207, WFE-286): the scrollback keeps the top row and scrolls on its
 * own, the box sits in a row of its own under it, outside the scrolling area.
 * Files pasted or dropped onto the pane go to the box's own media (WFE-289,
 * ./usePaneDrop) and not to the command line's pending media; the pane is
 * framed while a file is dragged over it. A pane with no box takes none.
 * Presentational: the DM window and the thread window hand it their
 * scrollback, their box and where the files go.
 */

import type { JSX, ReactNode } from 'react';

import styles from './DockedInput.module.css';
import { usePaneDrop } from './usePaneDrop';

/** What the layout holds: the scrollback and, under it, the box. */
export type DockedInputProps = {
  /** The scrollback: the window's log region. */
  readonly children: ReactNode;
  /** The input box docked under it; null docks nothing, the scrollback alone. */
  readonly input: ReactNode;
  /** Takes the files pasted or dropped onto the pane: the box's media. */
  readonly onFiles: (files: readonly File[]) => void;
};

/** {@link DockedInputProps.children} over the docked {@link DockedInputProps.input}. */
export function DockedInput(props: DockedInputProps): JSX.Element {
  const { dragging, ...drop } = usePaneDrop(props.onFiles);
  if (props.input === null) {
    return <div className={styles['window']}>{props.children}</div>;
  }
  return (
    <div className={[styles['window'], dragging ? styles['dropping'] : ''].join(' ')} {...drop}>
      {props.children}
      <div className={styles['input']}>{props.input}</div>
    </div>
  );
}
