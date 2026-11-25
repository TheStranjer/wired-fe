/**
 * The active desktop, drawn (WFE-212, decision 12): its split tree as nested
 * flex containers sized by each split's ratio, every leaf a PaneFrame around
 * its own window's content, so two panes can show two different scrollbacks.
 * The focused pane wears the focus frame; a pointer-down on any pane asks to
 * focus it. Between a split's halves sits a Divider that dispatches the new
 * ratio for the split's path (WFE-221).
 */
import { useCallback, useRef } from 'react';
import type { JSX, ReactNode } from 'react';

import styles from './DesktopView.module.css';
import { accountLabel } from './StatusBar';
import { WindowBody, windowTopic } from './WindowBody';
import type { AppState } from '../state/appState';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { Divider } from '../ui/Divider';
import { PaneFrame } from '../ui/PaneFrame';
import { activeDesktop } from '../windows/desktops';
import { MAX_RATIO, MIN_RATIO } from '../windows/splitRatio';
import type { SplitPath } from '../windows/splitRatio';
import type { PaneLeaf, SplitNode, SplitTree } from '../windows/splitTree';

/** What every node of the tree needs to draw itself. */
type View = {
  readonly state: AppState;
  readonly focusedPaneId: string | null;
  readonly focus: (paneId: string) => void;
  readonly setRatio: (path: SplitPath, ratio: number) => void;
};

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

/** A pane: a frame titled by its window, holding that window's content. */
function Pane(props: { readonly leaf: PaneLeaf; readonly view: View }): JSX.Element | null {
  const { leaf, view } = props;
  const win = view.state.windows.windows.find((candidate) => candidate.id === leaf.windowId);
  if (win === undefined) {
    return null;
  }
  return (
    <PaneFrame
      title={win.title}
      subtitle={accountLabel(view.state, win.ref.accountKey)}
      topic={windowTopic(win, view.state)}
      focused={leaf.paneId === view.focusedPaneId}
      actions={null}
      onFocusRequest={() => {
        view.focus(leaf.paneId);
      }}
    >
      <WindowBody win={win} state={view.state} />
    </PaneFrame>
  );
}

/** A split: its two halves with a divider between, sized by the ratio. */
function Split(props: {
  readonly tree: SplitNode;
  readonly path: SplitPath;
  readonly view: View;
}): JSX.Element {
  const { tree, path, view } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const row = tree.dir === 'row';
  return (
    <div ref={containerRef} className={row ? styles['row'] : styles['column']}>
      <Half grow={tree.ratio}>
        <Node tree={tree.a} path={[...path, 'a']} view={view} />
      </Half>
      <Divider
        bounds={{ min: MIN_RATIO, max: MAX_RATIO }}
        containerRef={containerRef}
        onRatioChange={(ratio) => {
          view.setRatio(path, ratio);
        }}
        orientation={row ? 'vertical' : 'horizontal'}
        ratio={tree.ratio}
      />
      <Half grow={1 - tree.ratio}>
        <Node tree={tree.b} path={[...path, 'b']} view={view} />
      </Half>
    </div>
  );
}

/** A subtree at `path`: a pane, or a split. */
function Node(props: {
  readonly tree: SplitTree;
  readonly path: SplitPath;
  readonly view: View;
}): JSX.Element | null {
  const { tree, path, view } = props;
  return tree.type === 'pane' ? (
    <Pane leaf={tree} view={view} />
  ) : (
    <Split tree={tree} path={path} view={view} />
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
  const setRatio = useCallback(
    (path: SplitPath, ratio: number) => {
      dispatch({ type: 'layout', action: { type: 'setRatio', path, ratio } });
    },
    [dispatch],
  );
  const view: View = { state, focusedPaneId: desktop.focusedPaneId, focus, setRatio };
  return (
    <div className={styles['desktop']}>
      {desktop.tree === null ? (
        <div className={styles['empty']}>empty desktop — /vsplit, /split or Ctrl+B %</div>
      ) : (
        <Node tree={desktop.tree} path={[]} view={view} />
      )}
    </div>
  );
}
