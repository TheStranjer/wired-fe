/**
 * The active desktop, drawn (WFE-212, decision 12): its split tree as nested
 * flex containers sized by each split's ratio, every leaf a PaneFrame around
 * its own window's content, so two panes can show two different scrollbacks.
 * The focused pane wears the focus frame; a pointer-down on any pane asks to
 * focus it. Floats are drawn above the tree by the float layer.
 */
import { useCallback } from 'react';
import type { JSX, ReactNode } from 'react';

import { Pane, windowOf } from './DesktopPane';
import type { View } from './DesktopPane';
import styles from './DesktopView.module.css';
import { FloatLayer } from './FloatLayer';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { activeDesktop } from '../windows/desktops';
import type { PaneLeaf, SplitTree } from '../windows/splitTree';

/** One half of a split, taking `grow` of the room along the split's axis. */
function Half(props: { readonly grow: number; readonly children: ReactNode }): JSX.Element {
  const { grow } = props;
  const setGrow = useCallback(
    (element: HTMLDivElement | null) => {
      element?.style.setProperty('flex-grow', String(grow));
    },
    [grow],
  );
  return (
    <div ref={setGrow} className={styles['half']}>
      {props.children}
    </div>
  );
}

/** A tree pane: its window's frame, or nothing when the window is gone. */
function TreePane(props: { readonly leaf: PaneLeaf; readonly view: View }): JSX.Element | null {
  const { leaf, view } = props;
  const win = windowOf(view, leaf.windowId);
  return win === undefined ? null : <Pane paneId={leaf.paneId} win={win} view={view} />;
}

/** A subtree: a pane, or a split of two halves. */
function Node(props: { readonly tree: SplitTree; readonly view: View }): JSX.Element | null {
  const { tree, view } = props;
  if (tree.type === 'pane') {
    return <TreePane leaf={tree} view={view} />;
  }
  return (
    <div className={tree.dir === 'row' ? styles['row'] : styles['column']}>
      <Half grow={tree.ratio}>
        <Node tree={tree.a} view={view} />
      </Half>
      <Half grow={1 - tree.ratio}>
        <Node tree={tree.b} view={view} />
      </Half>
    </div>
  );
}

/** The active desktop: its tree of panes, or a hint when it has none. */
export function DesktopView(): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const desktop = activeDesktop(state.layout);
  const focus = useCallback(
    (paneId: string) => {
      dispatch({ type: 'layout', action: { type: 'focusPane', paneId } });
    },
    [dispatch],
  );
  const view: View = { state, focusedPaneId: desktop.focusedPaneId, focus };
  return (
    <div className={styles['desktop']}>
      {desktop.tree === null ? (
        <div className={styles['empty']}>empty desktop — /vsplit, /split or Ctrl+B %</div>
      ) : (
        <Node tree={desktop.tree} view={view} />
      )}
      <FloatLayer floats={desktop.floats} view={view} />
    </div>
  );
}
