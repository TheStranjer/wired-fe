/**
 * The shell: the fixed layout that arranges the global header, the desktop
 * of panes, the status line and the command line (AGENTS.md "Windows, like
 * IRC buffers"). Presentational only: which content fills each region belongs
 * to the app and feature layers.
 */
import type { JSX, ReactNode } from 'react';

import styles from './Shell.module.css';

/** The regions of the screen, each filled by a higher layer. */
export type ShellProps = {
  /** Global header chrome, one line across the top full width. */
  readonly header: ReactNode;
  /** The desktop, the tall region between the header and the status line. */
  readonly scrollback: ReactNode;
  /** The accessible name of the scrollback region, e.g. `Desktop 1`. */
  readonly scrollbackLabel?: string | undefined;
  /** The status line, directly above the command line. */
  readonly statusLine: ReactNode;
  /** The start menu, at the left end of the status line (WFE-299); absent shows nothing. */
  readonly start?: ReactNode;
  /** The tray of pending media, between the status line and the command line (WFE-287); absent shows nothing. */
  readonly tray?: ReactNode;
  /** The command line, at the very bottom. */
  readonly input: ReactNode;
};

/** The viewport-filling grid of the four shell regions. */
export function Shell(props: ShellProps): JSX.Element {
  const { header, scrollback, scrollbackLabel, start, statusLine, tray, input } = props;

  return (
    <div className={styles['shell']}>
      <header className={styles['header']}>{header}</header>
      <main aria-label={scrollbackLabel} className={styles['scrollback']}>
        {scrollback}
      </main>
      <footer className={styles['footer']}>
        <div className={styles['statusRow']}>
          {start}
          <div className={styles['statusLine']}>{statusLine}</div>
        </div>
        {tray}
        <div className={styles['inputLine']}>{input}</div>
      </footer>
    </div>
  );
}
