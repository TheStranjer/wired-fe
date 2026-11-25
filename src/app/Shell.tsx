/**
 * The shell: the fixed layout that arranges the global header, the desktop
 * of panes, the side pane, the status line and the command line
 * (AGENTS.md "Windows, like IRC buffers"). Presentational only: which content
 * fills each region belongs to the app and feature layers.
 */
import type { JSX, ReactNode } from 'react';

import styles from './Shell.module.css';

/** The five regions of the screen, each filled by a higher layer. */
export type ShellProps = {
  /** Global header chrome, one line across the top full width. */
  readonly header: ReactNode;
  /** The active window's scrollback, the tall region on the left. */
  readonly scrollback: ReactNode;
  /** The accessible name of the scrollback region, e.g. `Desktop 1`. */
  readonly scrollbackLabel?: string | undefined;
  /** The user list beside the scrollback. */
  readonly sidePane: ReactNode;
  /** The status line, directly above the command line. */
  readonly statusLine: ReactNode;
  /** The command line, at the very bottom. */
  readonly input: ReactNode;
};

/** The viewport-filling grid of the five shell regions. */
export function Shell(props: ShellProps): JSX.Element {
  const { header, scrollback, scrollbackLabel, sidePane, statusLine, input } = props;

  return (
    <div className={styles['shell']}>
      <header className={styles['header']}>{header}</header>
      <main aria-label={scrollbackLabel} className={styles['scrollback']}>
        {scrollback}
      </main>
      <aside aria-label="Users" className={styles['sidePane']}>
        {sidePane}
      </aside>
      <footer className={styles['footer']}>
        <div className={styles['statusLine']}>{statusLine}</div>
        <div className={styles['inputLine']}>{input}</div>
      </footer>
    </div>
  );
}
