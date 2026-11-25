/**
 * The buttons in a pane's title bar (WFE-228, WFE-229, WFE-236, decision 6):
 * each one focuses its own pane, then runs a command line through the runner
 * the command line lends the views, exactly as a hotkey or a typed command
 * would. `┃▾` and `━▾` split that pane side by side or stacked with a view
 * chosen from a menu (`/vsplit <view>`, `/split <view>`); `◐▾` sets how its
 * posts are drawn; `✕` closes it. A tree pane also has `⧉▾`, which pops it
 * (`This pane`) or a view out into a float (`/float [view]`); a float has `⊞`
 * (`/dock`) instead, and no split buttons (WFE-230).
 */
import { useCallback, useMemo } from 'react';
import type { JSX } from 'react';

import { displayItems, displayLine, showsPosts } from './displayMenu';
import styles from './PaneActions.module.css';
import { entryLine, paneMenuEntries, popOutEntries } from './paneMenu';
import type { PaneMenuEntry, ViewCommand } from './paneMenu';
import { useAvailableRegistry } from './useAvailableRegistry';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { MenuButton } from '../ui/MenuButton';
import type { PostActionLine } from '../ui/postActionTypes';
import { usePostActions } from '../views/PostActionsContext';
import { activeDesktop } from '../windows/desktops';
import { findFloat } from '../windows/floats';
import type { WindowState } from '../windows/model';

/** One of the view-menu buttons: its glyph, accessible name and command. */
type SplitButton = {
  readonly glyph: string;
  readonly label: string;
  readonly command: ViewCommand;
};

/** The split buttons, side by side first. */
const SPLIT_BUTTONS: readonly SplitButton[] = [
  { glyph: '┃▾', label: 'Split side by side', command: 'vsplit' },
  { glyph: '━▾', label: 'Split stacked', command: 'split' },
];

/** The pop-out button, which takes `This pane` as well as the views. */
const POP_OUT: SplitButton = { glyph: '⧉▾', label: 'Pop out', command: 'float' };

/** A function that focuses pane `paneId`, then runs or fills a command line for it. */
function useRunOnPane(paneId: string): (line: PostActionLine) => void {
  const dispatch = useAppDispatch();
  const { run } = usePostActions();
  return useCallback(
    (line) => {
      dispatch({ type: 'layout', action: { type: 'focusPane', paneId } });
      // React flushes the focus when the event ends, so by this microtask the
      // runner holds the state with this pane focused.
      queueMicrotask(() => {
        run(line);
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
        runOnPane({ line: displayLine(id, settings, win), prefill: false });
      }}
    />
  );
}

/** One view-menu button over {@link entries}. */
function SplitMenu(props: {
  readonly button: SplitButton;
  readonly entries: readonly PaneMenuEntry[];
  readonly runOnPane: (line: PostActionLine) => void;
}): JSX.Element {
  const { button, entries, runOnPane } = props;
  const select = (id: string): void => {
    for (const entry of entries.filter((candidate) => candidate.id === id)) {
      runOnPane({ line: entryLine(entry, button.command), prefill: entry.prefill });
    }
  };
  return <MenuButton label={button.label} glyph={button.glyph} items={entries} onSelect={select} />;
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

/** The split and pop-out buttons of a tree pane. */
function TreeButtons(props: { readonly paneId: string }): JSX.Element {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const runOnPane = useRunOnPane(props.paneId);
  const entries = useMemo(
    () => paneMenuEntries(registry, settings.feeds),
    [registry, settings.feeds],
  );
  const popOut = useMemo(() => popOutEntries(entries), [entries]);
  return (
    <>
      {SPLIT_BUTTONS.map((button) => (
        <SplitMenu key={button.command} button={button} entries={entries} runOnPane={runOnPane} />
      ))}
      <SplitMenu button={POP_OUT} entries={popOut} runOnPane={runOnPane} />
    </>
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
      {showsPosts(win) ? <DisplayMenu paneId={paneId} win={win} /> : null}
      {floating ? <DockButton paneId={paneId} win={win} /> : <TreeButtons paneId={paneId} />}
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
