/**
 * The buttons in a pane's title bar (WFE-228, decision 6): each one focuses
 * its own pane, then runs a command line through the runner the command line
 * lends the views, exactly as a hotkey or a typed command would. Later
 * tickets add their split, float and display buttons here.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';

import styles from './PaneActions.module.css';
import { useAppDispatch } from '../state/StateContext';
import { usePostActions } from '../views/PostActionsContext';

/** The title-bar buttons of the pane `paneId`, whose title is `title`. */
export function PaneActions(props: {
  readonly paneId: string;
  readonly title: string;
}): JSX.Element {
  const { paneId, title } = props;
  const dispatch = useAppDispatch();
  const { run } = usePostActions();
  const close = useCallback(() => {
    dispatch({ type: 'layout', action: { type: 'focusPane', paneId } });
    // React flushes the focus when the event ends, so by this microtask the
    // runner holds the state with this pane focused.
    queueMicrotask(() => {
      run({ line: '/unsplit', prefill: false });
    });
  }, [dispatch, paneId, run]);
  return (
    <button
      type="button"
      className={styles['button']}
      aria-label={`Close pane ${title}`}
      onClick={close}
    >
      ✕
    </button>
  );
}
