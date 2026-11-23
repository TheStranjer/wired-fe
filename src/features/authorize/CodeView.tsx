/**
 * The authorization code of an out-of-band app (WFE-168), shown for the user
 * to hand to the app, with a copy button. A browser that refuses the clipboard
 * write is told so; the code stays on screen to copy by hand.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import styles from './AuthorizeBox.module.css';

/** What the copy button last did. */
type Copied = 'idle' | 'done' | 'failed';

/** What each {@link Copied} state says. */
const NOTE: Readonly<Record<Copied, string>> = {
  idle: '',
  done: 'Copied to the clipboard.',
  failed: 'Could not copy. Select the code and copy it by hand.',
};

/** The code, its copy button and a close button. */
export function CodeView(props: {
  readonly code: string;
  readonly onClose: () => void;
}): JSX.Element {
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
      <p className={styles['line']}>Authorized. Give this code to the app:</p>
      <p className={styles['code']}>
        <code>{props.code}</code>
      </p>
      <p role="status">{NOTE[copied]}</p>
      <div className={styles['actions']}>
        <button
          className={styles['button']}
          onClick={() => {
            void copy();
          }}
          type="button"
        >
          [ copy ]
        </button>
        <button
          className={styles['button']}
          onClick={() => {
            props.onClose();
          }}
          type="button"
        >
          [ close ]
        </button>
      </div>
    </>
  );
}
