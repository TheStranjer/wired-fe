/**
 * The buttons in a pane's title bar (WFE-228, WFE-229, WFE-236, decision 6):
 * each one focuses its own pane, then runs a command line through the runner
 * the command line lends the views, exactly as a hotkey or a typed command
 * would. `┃▾` and `━▾` split that pane side by side or stacked with a view
 * chosen from a menu (`/vsplit <view>`, `/split <view>`); `◐▾` sets how its
 * posts are drawn; `✕` closes it. A tree pane also has `⧉▾`, which pops it
 * (`This pane`) or a view out into a float (`/float [view]`); a float has `⊞`
 * (`/dock`) instead, and no split buttons (WFE-230). In all three menus
 * `Existing window…` swaps the rows for a list of the other open windows and
 * runs `/vsplit win N` (or `/split`, `/float`) for the one chosen (WFE-270).
 */
import { useCallback } from 'react';
import type { JSX } from 'react';

import { displayItems, displayLine, showsPosts } from './displayMenu';
import styles from './PaneActions.module.css';
import { TreeButtons } from './TreeButtons';
import { useRunOnPane } from './useRunOnPane';
import { feedById } from '../state/feeds';
import { useAppState } from '../state/StateContext';
import { MenuButton } from '../ui/MenuButton';
import { activeDesktop } from '../windows/desktops';
import { findFloat } from '../windows/floats';
import type { WindowState } from '../windows/model';

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
        runOnPane({ line: displayLine(id, settings, win), prefill: false });
      }}
    />
  );
}

/** The `⊞` button of a float: puts it back in the tree. */
function DockButton(props: { readonly paneId: string; readonly win: WindowState }): JSX.Element {
  const { paneId, win } = props;
  const runOnPane = useRunOnPane(paneId);
  return (
    <button
      type="button"
      className={styles['button']}
      aria-label={`Dock ${win.title}`}
      onClick={() => {
        runOnPane({ line: '/dock', prefill: false });
      }}
    >
      ⊞
    </button>
  );
}

/** The `✎` button of a feed window: its feed's editor takes the pane (WFE-242). */
function EditFeedButton(props: {
  readonly paneId: string;
  readonly win: WindowState;
}): JSX.Element | null {
  const { paneId, win } = props;
  const { settings } = useAppState();
  const runOnPane = useRunOnPane(paneId);
  const feed = feedById(settings.feeds, win.ref.target ?? '');
  if (win.ref.kind !== 'feed' || feed === undefined) {
    return null;
  }
  return (
    <button
      type="button"
      className={styles['button']}
      aria-label={`Edit feed ${win.title}`}
      onClick={() => {
        runOnPane({ line: `/feed edit ${feed.name}`, prefill: false });
      }}
    >
      ✎
    </button>
  );
}

/** The title-bar buttons of the pane `paneId`, which shows the window `win`. */
export function PaneActions(props: {
  readonly paneId: string;
  readonly win: WindowState;
}): JSX.Element {
  const { paneId, win } = props;
  const { layout } = useAppState();
  const floating = findFloat(activeDesktop(layout).floats, paneId) !== null;
  const runOnPane = useRunOnPane(paneId);
  const close = useCallback(() => {
    runOnPane({ line: '/unsplit', prefill: false });
  }, [runOnPane]);
  return (
    <>
      <EditFeedButton paneId={paneId} win={win} />
      {showsPosts(win) ? <DisplayMenu paneId={paneId} win={win} /> : null}
      {floating ? (
        <DockButton paneId={paneId} win={win} />
      ) : (
        <TreeButtons paneId={paneId} win={win} />
      )}
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
