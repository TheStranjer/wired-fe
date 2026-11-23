/**
 * Root component: the visually hidden page heading, and the shell wired to
 * real state — <Root /> over the one application store (src/state) and the
 * token refresher that lets it recover from an expired token.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import styles from './App.module.css';
import { appRefresher } from './appRefresher';
import { Root } from './Root';
import { RefresherProvider } from '../state/RefreshContext';
import { AppStateProvider } from '../state/StateContext';

/** The whole application: the heading and the live shell below it. */
export function App(): JSX.Element {
  const [refresher] = useState(appRefresher);
  return (
    <>
      <h1 className={styles['visuallyHidden']}>WIRED</h1>
      <AppStateProvider>
        <RefresherProvider refresher={refresher}>
          <Root />
        </RefresherProvider>
      </AppStateProvider>
    </>
  );
}
