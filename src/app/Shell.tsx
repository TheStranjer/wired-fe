/**
 * The shell: the fixed layout that arranges the topic bar, the active
 * window's scrollback, the side pane, the status line and the command line
 * (AGENTS.md "Windows, like IRC buffers"). Presentational only: which content
 * fills each region belongs to the app and feature layers.
 */
import type { JSX, ReactNode } from 'react';

import styles from './Shell.module.css';

/** The five regions of the screen, each filled by a higher layer. */
export type ShellProps = {
  /** Topic bar content, across the top full width. */
  readonly topic: ReactNode;
  /** The active window's scrollback, the tall region on the left. */
  readonly scrollback: ReactNode;
  /** The user list beside the scrollback. */
  readonly sidePane: ReactNode;
  /** The status line, directly above the command line. */
  readonly statusLine: ReactNode;
  /** The command line, at the very bottom. */
  readonly input: ReactNode;
};

/** The viewport-filling grid of the five shell regions. */
export function Shell(props: ShellProps): JSX.Element {
  const { topic, scrollback, sidePane, statusLine, input } = props;

  return (
    <div className={styles['shell']}>
      <header className={styles['topic']}>{topic}</header>
      <main className={styles['scrollback']}>{scrollback}</main>
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
