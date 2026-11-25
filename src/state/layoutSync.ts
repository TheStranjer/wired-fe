/**
 * Keeps the window list and the desktops in step (ARCHITECTURE.md decision 12:
 * the focused pane's window is `windows.activeId`). Pure: each function takes
 * the two halves of the app state as a {@link SyncSlice} and hands back the
 * pair, with a half returned as the very same object when it did not change.
 *
 * 1. A layout action that moves focus makes the focused pane's window active.
 * 2. A windows action that changes the active window focuses the pane that
 *    shows it on the active desktop, else shows it in the focused pane (or
 *    starts an empty desktop with it).
 * 3. Closing a window closes every pane and float showing it, on every desktop.
 * 4. Windows shown nowhere stay open as hidden buffers.
 * 5. A window visible on the active desktop does not gather unread.
 */
import { removeDesktopPane, shownPanes } from '../windows/desktopPanes';
import type { Desktop } from '../windows/desktopPanes';
import {
  activeDesktop,
  focusPane,
  focusedWindowId,
  splitFocused,
  updateActive,
} from '../windows/desktops';
import type { DesktopsState } from '../windows/desktops';
import { setFloatWindow } from '../windows/floats';
import type { LayoutAction } from '../windows/layoutAction';
import { layoutReducer } from '../windows/layoutReducer';
import { withActive } from '../windows/model';
import type { WindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';
import type { WindowsAction } from '../windows/reducer';
import { setPaneWindow } from '../windows/splitTree';

/** The two halves of the app state that have to agree. */
export type SyncSlice = {
  readonly windows: WindowsState;
  readonly layout: DesktopsState;
};

/** Whether the active desktop shows window {@link windowId} in some pane or float. */
export function isVisible(layout: DesktopsState, windowId: string): boolean {
  return shownPanes(activeDesktop(layout)).some((pane) => pane.windowId === windowId);
}

/** Rule 1: the window of the focused pane becomes the active one; an empty desktop changes nothing. */
function followFocus(windows: WindowsState, layout: DesktopsState): WindowsState {
  const focused = focusedWindowId(layout);
  return focused === null || focused === windows.activeId ? windows : withActive(windows, focused);
}

/** Moves the desktops along by a layout action, then makes the focused pane's window active. */
export function applyLayoutAction(slice: SyncSlice, action: LayoutAction): SyncSlice {
  const layout = layoutReducer(slice.layout, action);
  if (layout === slice.layout) {
    return slice;
  }
  return { windows: followFocus(slice.windows, layout), layout };
}

/** Shows {@link windowId} in the pane or float {@link paneId}, whichever it is. */
function replaceWindow(desktop: Desktop, paneId: string, windowId: string): Desktop {
  const tree = desktop.tree === null ? null : setPaneWindow(desktop.tree, paneId, windowId);
  return { ...desktop, tree, floats: setFloatWindow(desktop.floats, paneId, windowId) };
}

/**
 * Rule 2: the active desktop's pane showing {@link windowId} gets focus (the
 * focused one when several show it); with none, the focused pane shows it
 * instead, and an empty desktop gets its first pane.
 */
function reveal(layout: DesktopsState, windowId: string): DesktopsState {
  const desktop = activeDesktop(layout);
  const showing = shownPanes(desktop).filter((pane) => pane.windowId === windowId);
  const target = showing.find((pane) => pane.paneId === desktop.focusedPaneId) ?? showing[0];
  if (target !== undefined) {
    return focusPane(layout, target.paneId);
  }
  const { focusedPaneId } = desktop;
  if (focusedPaneId === null) {
    return splitFocused(layout, 'row', windowId);
  }
  return updateActive(layout, (current) => replaceWindow(current, focusedPaneId, windowId));
}

/** Every desktop with the panes and floats showing {@link windowId} closed, as `closePane` would. */
function closeShowing(layout: DesktopsState, windowId: string): DesktopsState {
  const desktops = layout.desktops.map((desktop) =>
    shownPanes(desktop)
      .filter((pane) => pane.windowId === windowId)
      .reduce((rest, pane) => removeDesktopPane(rest, pane.paneId), desktop),
  );
  return desktops.every((desktop, i) => desktop === layout.desktops[i])
    ? layout
    : { ...layout, desktops };
}

/** Rule 3: the window left the list, so its panes go, and focus decides the active window. */
function closed(slice: SyncSlice, windows: WindowsState, id: string): SyncSlice {
  const layout = closeShowing(slice.layout, id);
  return { windows: followFocus(windows, layout), layout };
}

/**
 * Moves the window list along by a windows action and keeps the desktops in
 * step: a closed window's panes close, a new active window is revealed, and
 * unread is not counted for a visible window (rule 5).
 */
export function applyWindowsAction(slice: SyncSlice, action: WindowsAction): SyncSlice {
  if (action.type === 'markUnread' && isVisible(slice.layout, action.id)) {
    return slice;
  }
  const windows = windowsReducer(slice.windows, action);
  if (action.type === 'close' && windows.windows.length < slice.windows.windows.length) {
    return closed(slice, windows, action.id);
  }
  if (windows.activeId === slice.windows.activeId) {
    return { windows, layout: slice.layout };
  }
  return { windows, layout: reveal(slice.layout, windows.activeId) };
}
