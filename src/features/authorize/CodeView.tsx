/**
 * The authorization code of an out-of-band app (WFE-168), shown for the user
 * to hand to the app, with a copy button. A browser that refuses the clipboard
 * write is told so; the code stays on screen to copy by hand.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import styles from './AuthorizeBox.module.css';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';

/** What the copy button last did. */
type Copied = 'idle' | 'done' | 'failed';

/** The message each {@link Copied} state besides `idle` says. */
const NOTE: Readonly<Record<Exclude<Copied, 'idle'>, MessageKey>> = {
  done: 'features.authorize.copied',
  failed: 'features.authorize.copy_failed',
};

/** The code, its copy button and a close button. */
export function CodeView(props: {
  readonly code: string;
  readonly onClose: () => void;
}): JSX.Element {
  const t = useT();
  const [copied, setCopied] = useState<Copied>('idle');

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  }

  return (
    <>
      <p className={styles['line']}>{t('features.authorize.code_intro')}</p>
      <p className={styles['code']}>
        <code>{props.code}</code>
      </p>
      <p role="status">{copied === 'idle' ? '' : t(NOTE[copied])}</p>
      <div className={styles['actions']}>
        <button
          className={styles['button']}
          onClick={() => {
            void copy();
          }}
          type="button"
        >
          {t('features.authorize.copy_button')}
        </button>
        <button
          className={styles['button']}
          onClick={() => {
            props.onClose();
          }}
          type="button"
        >
          {t('features.authorize.close_button')}
        </button>
      </div>
    </>
  );
}
