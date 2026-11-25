/**
 * The one line of global chrome across the top of the screen: `WIRED` at the
 * left and the active account's handle at the right, so the active account is
 * always visible whichever pane has focus. Everything per-window lives in the
 * pane title bars (./DesktopView).
 */
import type { JSX } from 'react';

import styles from './AppHeader.module.css';
import { accountLabel } from './StatusBar';
import { useAppState } from '../state/StateContext';

/** Shown in place of a handle while no account is signed in. */
const NO_ACCOUNT = 'no account';

/** The header line: the product name and the active account. */
export function AppHeader(): JSX.Element {
  const state = useAppState();
  const handle = accountLabel(state, state.activeAccountKey);
  return (
    <div className={styles['bar']}>
      <span className={styles['name']}>WIRED</span>
      <span className={styles['account']}>{handle ?? NO_ACCOUNT}</span>
    </div>
  );
}
