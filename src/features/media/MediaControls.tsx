/**
 * The controls of a media window (WFE-263): `‹` and `›` step to the previous
 * or next attachment of the post — disabled at the ends, absent for a post
 * with one — and `Open original ↗` sends the file to the browser. Opening goes
 * through the line runner as `/open <url>`, the command's own path, so a click
 * and the command are one thing (decision 6); the http(s) check and the
 * `noopener` tab are `/open`'s.
 */
import type { JSX } from 'react';

import styles from './MediaViewer.module.css';
import { usePostActions } from '../../views/PostActionsContext';

/** Props of {@link MediaSteps}. */
type StepsProps = {
  /** The 1-based index shown and how many attachments the post has. */
  readonly n: number;
  readonly total: number;
  readonly onStep: (n: number) => void;
};

/** The previous and next buttons; nothing for a post with one attachment. */
export function MediaSteps(props: StepsProps): JSX.Element | null {
  const { n, total, onStep } = props;
  if (total < 2) {
    return null;
  }
  return (
    <>
      <button
        aria-label="Previous attachment"
        className={styles['button']}
        disabled={n <= 1}
        onClick={() => {
          onStep(n - 1);
        }}
        type="button"
      >
        ‹
      </button>
      <button
        aria-label="Next attachment"
        className={styles['button']}
        disabled={n >= total}
        onClick={() => {
          onStep(n + 1);
        }}
        type="button"
      >
        ›
      </button>
    </>
  );
}

/** The button that runs `/open <url>` for the file at {@link props.url}. */
export function OpenOriginal(props: { readonly url: string }): JSX.Element {
  const { run } = usePostActions();
  return (
    <button
      className={styles['button']}
      onClick={() => {
        run({ line: `/open ${props.url}`, prefill: false });
      }}
      type="button"
    >
      Open original ↗
    </button>
  );
}
