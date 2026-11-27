/**
 * What stands where a thread window's reply box would (WFE-340): a window a
 * signed-out visitor reads has no account to reply as, so the box is replaced
 * by one line that says to sign in and where `/connect` is.
 */

import type { JSX } from 'react';

import styles from './SignInNote.module.css';
import { useT } from '../../i18n/I18nProvider';

/** The one-line "sign in to reply" note. */
export function SignInNote(): JSX.Element {
  const t = useT();
  return <p className={styles['note']}>{t('features.thread.sign_in_to_reply')}</p>;
}
