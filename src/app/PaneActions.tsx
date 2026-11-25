/**
 * The buttons in a pane's title bar (WFE-228, WFE-229, WFE-236, decision 6):
 * each one focuses its own pane, then runs a command line through the runner
 * the command line lends the views, exactly as a hotkey or a typed command
 * would. `┃▾` and `━▾` split that pane side by side or stacked with a view
 * chosen from a menu (`/vsplit <view>`, `/split <view>`); `◐▾` sets how its
 * posts are drawn; `✕` closes it. Later tickets add their float button here.
 */
import { useCallback, useMemo } from 'react';
import type { JSX } from 'react';

import { displayItems, displayLine, showsPosts } from './displayMenu';
import styles from './PaneActions.module.css';
import { entryLine, paneMenuEntries } from './paneMenu';
import type { PaneMenuEntry } from './paneMenu';
import { useAvailableRegistry } from './useAvailableRegistry';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { MenuButton } from '../ui/MenuButton';
import type { PostActionLine } from '../ui/postActionTypes';
import { usePostActions } from '../views/PostActionsContext';
import type { WindowState } from '../windows/model';

/** One of the two split buttons: its glyph, accessible name and command. */
type SplitButton = {
  readonly glyph: string;
  readonly label: string;
  readonly command: 'vsplit' | 'split';
};

/** The split buttons, side by side first. */
const SPLIT_BUTTONS: readonly SplitButton[] = [
  { glyph: '┃▾', label: 'Split side by side', command: 'vsplit' },
  { glyph: '━▾', label: 'Split stacked', command: 'split' },
];

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

/** One split button over the shared {@link entries}. */
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

/** The title-bar buttons of the pane `paneId`, which shows the window `win`. */
export function PaneActions(props: {
  readonly paneId: string;
  readonly win: WindowState;
}): JSX.Element {
  const { paneId, win } = props;
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const runOnPane = useRunOnPane(paneId);
  const entries = useMemo(
    () => paneMenuEntries(registry, settings.feeds),
    [registry, settings.feeds],
  );
  const close = useCallback(() => {
    runOnPane({ line: '/unsplit', prefill: false });
  }, [runOnPane]);
  return (
    <>
      {showsPosts(win) ? <DisplayMenu paneId={paneId} win={win} /> : null}
      {SPLIT_BUTTONS.map((button) => (
        <SplitMenu key={button.command} button={button} entries={entries} runOnPane={runOnPane} />
      ))}
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
