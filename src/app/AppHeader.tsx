/**
 * The one line of global chrome across the top of the screen: `WIRED` at the
 * left and the active account's handle at the right, so the active account is
 * always visible whichever pane has focus. Everything per-window lives in the
 * pane title bars (./DesktopView).
 */
import type { JSX } from 'react';

import styles from './AppHeader.module.css';
import { accountLabel } from './StatusBar';
import { useT } from '../i18n/I18nProvider';
import { useAppState } from '../state/StateContext';

/** The header line: the product name and the active account, or `no account` while none is signed in. */
export function AppHeader(): JSX.Element {
  const state = useAppState();
  const t = useT();
  const handle = accountLabel(state, state.activeAccountKey);
  return (
    <div className={styles['bar']}>
      <span className={styles['name']}>WIRED</span>
      <span className={styles['account']}>{handle ?? t('app.account_none')}</span>
    </div>
  );
}
