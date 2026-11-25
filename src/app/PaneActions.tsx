/**
 * The buttons in a pane's title bar (WFE-228, WFE-236, decision 6): each one
 * focuses its own pane, then runs a command line through the runner the
 * command line lends the views, exactly as a hotkey or a typed command would.
 * Later tickets add their split and float buttons here.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';

import { displayItems, displayLine, showsPosts } from './displayMenu';
import styles from './PaneActions.module.css';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { MenuButton } from '../ui/MenuButton';
import { usePostActions } from '../views/PostActionsContext';
import type { WindowState } from '../windows/model';

/** A function that focuses pane `paneId`, then runs a command line for it. */
function useRunOnPane(paneId: string): (line: string) => void {
  const dispatch = useAppDispatch();
  const { run } = usePostActions();
  return useCallback(
    (line: string) => {
      dispatch({ type: 'layout', action: { type: 'focusPane', paneId } });
      // React flushes the focus when the event ends, so by this microtask the
      // runner holds the state with this pane focused.
      queueMicrotask(() => {
        run({ line, prefill: false });
      });
    },
    [dispatch, paneId, run],
  );
}

/** The `◐▾` menu of the window `win`: how its posts are drawn. */
function DisplayMenu(props: { readonly paneId: string; readonly win: WindowState }): JSX.Element {
  const { paneId, win } = props;
  const { settings } = useAppState();
  const runOnPane = useRunOnPane(paneId);
  return (
    <MenuButton
      label={`Display options for ${win.title}`}
      glyph="◐▾"
      items={displayItems(settings, win)}
      onSelect={(id) => {
        runOnPane(displayLine(id, settings, win));
      }}
    />
  );
}

/** The title-bar buttons of the pane `paneId`, which shows the window `win`. */
export function PaneActions(props: {
  readonly paneId: string;
  readonly win: WindowState;
}): JSX.Element {
  const { paneId, win } = props;
  const runOnPane = useRunOnPane(paneId);
  const close = useCallback(() => {
    runOnPane('/unsplit');
  }, [runOnPane]);
  return (
    <>
      {showsPosts(win) ? <DisplayMenu paneId={paneId} win={win} /> : null}
      <button
        type="button"
        className={styles['button']}
        aria-label={`Close pane ${win.title}`}
        onClick={close}
      >
        ✕
      </button>
    </>
  );
}
