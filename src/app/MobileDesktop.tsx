/**
 * The desktop on a mobile device (WFE-247, decision 17): the layout model is
 * unchanged, but only the focused pane or float is drawn, full size, with no
 * dividers and no float drag or resize. Floats join the cycle after the tree
 * panes, the order `/focus next` walks. The title bar swaps its buttons for
 * the pane switcher.
 */
import type { JSX, ReactNode } from 'react';

import { Pane, windowOf } from './DesktopPane';
import type { View } from './DesktopPane';
import styles from './MobileDesktop.module.css';
import { PaneActions } from './PaneActions';
import { PaneSwitcher } from './PaneSwitcher';
import type { Desktop } from '../windows/desktopPanes';
import type { WindowState } from '../windows/model';
import { panes } from '../windows/splitTree';

/** One pane of the cycle with its window. */
type Entry = { readonly paneId: string; readonly win: WindowState };

/** Every pane of `desktop` whose window exists: tree panes in order, then floats bottom to top. */
function entriesOf(desktop: Desktop, view: View): readonly Entry[] {
  const inTree = desktop.tree === null ? [] : panes(desktop.tree);
  return [...inTree, ...desktop.floats].flatMap((pane) => {
    const win = windowOf(view, pane.windowId);
    return win === undefined ? [] : [{ paneId: pane.paneId, win }];
  });
}

/** The focused pane of `desktop` full size, or `empty` when it has none to show. */
export function MobileDesktop(props: {
  readonly desktop: Desktop;
  readonly view: View;
  readonly empty: ReactNode;
}): JSX.Element {
  const { desktop, view, empty } = props;
  const entries = entriesOf(desktop, view);
  const index = Math.max(
    entries.findIndex((entry) => entry.paneId === desktop.focusedPaneId),
    0,
  );
  const shown = entries[index];
  if (shown === undefined) {
    return <>{empty}</>;
  }
  const switcher = (
    <>
      <PaneSwitcher
        entries={entries.map((entry) => ({ paneId: entry.paneId, title: entry.win.title }))}
        index={index}
      />
      <PaneActions paneId={shown.paneId} title={shown.win.title} />
    </>
  );
  return (
    <div className={styles['single']}>
      <Pane paneId={shown.paneId} win={shown.win} view={view} actions={switcher} />
    </div>
  );
}
