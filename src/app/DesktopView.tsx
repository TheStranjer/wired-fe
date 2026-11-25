/**
 * The active desktop, drawn (WFE-212, decision 12): its split tree as nested
 * flex containers sized by each split's ratio, every leaf a PaneFrame around
 * its own window's content, so two panes can show two different scrollbacks.
 * The focused pane wears the focus frame; a pointer-down on any pane asks to
 * focus it. Between a split's halves sits a Divider that dispatches the new
 * ratio for the split's path (WFE-221). Floats are drawn above the tree by the
 * float layer.
 */
import { useCallback, useRef } from 'react';
import type { JSX, ReactNode } from 'react';

import { Pane, windowOf } from './DesktopPane';
import type { View } from './DesktopPane';
import styles from './DesktopView.module.css';
import { FloatLayer } from './FloatLayer';
import { MobileDesktop } from './MobileDesktop';
import { DEVICE_CLASS } from './readDeviceClass';
import type { DeviceClass } from '../lib/deviceClass';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { Divider } from '../ui/Divider';
import { activeDesktop } from '../windows/desktops';
import { MAX_RATIO, MIN_RATIO } from '../windows/splitRatio';
import type { SplitPath } from '../windows/splitRatio';
import type { PaneLeaf, SplitNode, SplitTree } from '../windows/splitTree';

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
    <TreePane leaf={tree} view={view} />
  ) : (
    <Split tree={tree} path={path} view={view} />
  );
}

/** The hint shown where an empty desktop has no pane to draw. */
const EMPTY_HINT = (
  <div className={styles['empty']}>empty desktop — /vsplit, /split or Ctrl+B %</div>
);

/**
 * The active desktop: its tree of panes, or a hint when it has none. On a
 * mobile device class (decision 17) only the focused pane or float is drawn.
 */
export function DesktopView(props: { readonly deviceClass?: DeviceClass }): JSX.Element {
  const { deviceClass = DEVICE_CLASS } = props;
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
  if (deviceClass === 'mobile') {
    return (
      <div className={styles['desktop']}>
        <MobileDesktop desktop={desktop} view={view} empty={EMPTY_HINT} />
      </div>
    );
  }
  return (
    <div className={styles['desktop']}>
      {desktop.tree === null ? EMPTY_HINT : <Node tree={desktop.tree} path={[]} view={view} />}
      <FloatLayer floats={desktop.floats} view={view} />
    </div>
  );
}
