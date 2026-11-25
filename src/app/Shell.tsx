/**
 * The shell: the fixed layout that arranges the topic bar, the desktop, the
 * status line and the command line (AGENTS.md "Windows, like IRC buffers").
 * Presentational only: which content fills each region belongs to the app and
 * feature layers.
 */
import type { JSX, ReactNode } from 'react';

import styles from './Shell.module.css';

/** The four regions of the screen, each filled by a higher layer. */
export type ShellProps = {
  /** Topic bar content, across the top full width. */
  readonly topic: ReactNode;
  /** The desktop, the tall region between the topic bar and the status line. */
  readonly scrollback: ReactNode;
  /** The accessible name of the scrollback region, e.g. `Desktop 1`. */
  readonly scrollbackLabel?: string | undefined;
  /** The status line, directly above the command line. */
  readonly statusLine: ReactNode;
  /** The command line, at the very bottom. */
  readonly input: ReactNode;
};

/** The viewport-filling grid of the four shell regions. */
export function Shell(props: ShellProps): JSX.Element {
  const { topic, scrollback, scrollbackLabel, statusLine, input } = props;

  return (
    <div className={styles['shell']}>
      <header className={styles['topic']}>{topic}</header>
      <main aria-label={scrollbackLabel} className={styles['scrollback']}>
        {scrollback}
      </main>
      <footer className={styles['footer']}>
        <div className={styles['statusLine']}>{statusLine}</div>
        <div className={styles['inputLine']}>{input}</div>
      </footer>
    </div>
  );
}
