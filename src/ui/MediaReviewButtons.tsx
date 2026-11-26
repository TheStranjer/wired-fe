/**
 * The two buttons of the media review box (WFE-290): `Cancel`, which never
 * submits, then `Submit`, which does. Split out of {@link MediaReviewDialog},
 * whose stylesheet it shares. Presentational.
 */
import type { JSX } from 'react';

import styles from './MediaReviewDialog.module.css';
import { useT } from '../i18n/I18nProvider';

/** `Cancel`, which never submits, then `Submit`, which does. */
export function ReviewButtons(props: { readonly onCancel: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className={styles['buttons']}>
      <button className={styles['button']} onClick={props.onCancel} type="button">
        {t('ui.media_review_dialog.cancel')}
      </button>
      <button className={styles['button']} type="submit">
        {t('ui.media_review_dialog.submit')}
      </button>
    </div>
  );
}
