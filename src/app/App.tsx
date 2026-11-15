/**
 * Root component: the visually hidden page heading, and the shell wired to
 * real state — <Root /> over the one application store (src/state).
 */
import type { JSX } from 'react';

import styles from './App.module.css';
import { Root } from './Root';
import { AppStateProvider } from '../state/StateContext';

/** The whole application: the heading and the live shell below it. */
export function App(): JSX.Element {
  return (
    <>
      <h1 className={styles['visuallyHidden']}>WIRED</h1>
      <AppStateProvider>
        <Root />
      </AppStateProvider>
    </>
  );
}
