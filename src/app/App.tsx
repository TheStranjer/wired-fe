/**
 * Root component. Placeholder boot screen until the shell layout ticket
 * replaces it with the scrollback, status line and command line.
 */
import type { JSX } from 'react';

import styles from './App.module.css';

/** The whole application. */
export function App(): JSX.Element {
  return (
    <main className={styles['shell']}>
      <h1 className={styles['banner']}>WIRED</h1>
      <p className={styles['motd']}>Present day. Present time.</p>
    </main>
  );
}
