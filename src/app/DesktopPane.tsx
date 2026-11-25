/**
 * One pane's frame, shared by the split tree and the float layer (WFE-212,
 * WFE-222): a PaneFrame titled by its window, holding that window's content.
 * A pointer-down anywhere in it asks to focus the pane, which also raises a
 * float.
 */
import type { JSX, ReactNode } from 'react';

import { PaneActions } from './PaneActions';
import { accountLabel } from './StatusBar';
import { WindowBody, windowTopic } from './WindowBody';
import type { AppState } from '../state/appState';
import { PaneFrame } from '../ui/PaneFrame';
import type { PaneFrameProps } from '../ui/PaneFrame';
import type { WindowState } from '../windows/model';
import type { SplitPath } from '../windows/splitRatio';

/** What every pane and float needs to draw itself. */
export type View = {
  readonly state: AppState;
  readonly focusedPaneId: string | null;
  readonly focus: (paneId: string) => void;
  readonly setRatio: (path: SplitPath, ratio: number) => void;
};

/** The window `windowId` of the session, or undefined when it is gone. */
export function windowOf(view: View, windowId: string): WindowState | undefined {
  return view.state.windows.windows.find((candidate) => candidate.id === windowId);
}

/** A pane or float: a frame titled by its window, holding that window's content. */
export function Pane(props: {
  readonly paneId: string;
  readonly win: WindowState;
  readonly view: View;
  readonly titleBarProps?: PaneFrameProps['titleBarProps'];
  /** Title-bar controls in place of the close button, e.g. the mobile pane switcher. */
  readonly actions?: ReactNode;
}): JSX.Element {
  const { paneId, win, view, titleBarProps, actions } = props;
  return (
    <PaneFrame
      title={win.title}
      subtitle={accountLabel(view.state, win.ref.accountKey)}
      topic={windowTopic(win, view.state)}
      focused={paneId === view.focusedPaneId}
      actions={actions ?? <PaneActions paneId={paneId} win={win} />}
      titleBarProps={titleBarProps}
      onFocusRequest={() => {
        view.focus(paneId);
      }}
    >
      <WindowBody win={win} state={view.state} />
    </PaneFrame>
  );
}
