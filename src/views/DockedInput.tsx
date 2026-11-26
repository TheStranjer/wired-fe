/**
 * The layout of a window with an input box docked under its scrollback
 * (WFE-207, WFE-286): the scrollback keeps the top row and scrolls on its
 * own, the box sits in a row of its own under it, outside the scrolling area.
 * Presentational: the DM window and the thread window hand it their
 * scrollback and their box.
 */

import type { JSX, ReactNode } from 'react';

import styles from './DockedInput.module.css';

/** What the layout holds: the scrollback and, under it, the box. */
export type DockedInputProps = {
  /** The scrollback: the window's log region. */
  readonly children: ReactNode;
  /** The input box docked under it; null docks nothing, the scrollback alone. */
  readonly input: ReactNode;
};

/** {@link DockedInputProps.children} over the docked {@link DockedInputProps.input}. */
export function DockedInput(props: DockedInputProps): JSX.Element {
  return (
    <div className={styles['window']}>
      {props.children}
      {props.input === null ? null : <div className={styles['input']}>{props.input}</div>}
    </div>
  );
}
