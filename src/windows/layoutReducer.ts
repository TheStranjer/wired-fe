/**
 * The reducer for all desktops (ARCHITECTURE.md decisions 12 and 18): one
 * action in, the next {@link DesktopsState} out, delegating every transition
 * to the pure modules. The actions are in four groups (layoutAction.ts); the
 * desktop and pane groups are handled here, floats and the split tree in
 * layoutTreeReducer.ts. Returns the state it was handed when nothing changes.
 */
import {
  closeDesktop,
  closeFocusedPane,
  dockFocused,
  floatFocused,
  focusPane,
  goToDesktop,
  movePaneToDesktop,
  newDesktop,
  splitFocused,
  stepDesktop,
} from './desktops';
import type { DesktopsState } from './desktops';
import type { DesktopAction, FloatAction, LayoutAction, PaneAction } from './layoutAction';
import { floatReducer, treeReducer } from './layoutTreeReducer';
import { moveFocus } from './paneFocus';

const DESKTOP_TYPES: ReadonlySet<string> = new Set<DesktopAction['type']>([
  'goToDesktop',
  'stepDesktop',
  'newDesktop',
  'closeDesktop',
  'movePaneToDesktop',
]);

const PANE_TYPES: ReadonlySet<string> = new Set<PaneAction['type']>([
  'focusPane',
  'focusStep',
  'split',
  'closePane',
  'float',
  'dock',
]);

const FLOAT_TYPES: ReadonlySet<string> = new Set<FloatAction['type']>([
  'moveFloat',
  'resizeFloat',
  'raiseFloat',
]);

/** Switches, creates, closes desktops or moves a pane to another. */
function desktopReducer(state: DesktopsState, action: DesktopAction): DesktopsState {
  switch (action.type) {
    case 'goToDesktop':
      return goToDesktop(state, action.n);
    case 'stepDesktop':
      return stepDesktop(state, action.step);
    case 'newDesktop':
      return newDesktop(state);
    case 'closeDesktop':
      return closeDesktop(state, action.n);
    case 'movePaneToDesktop':
      return movePaneToDesktop(state, action.paneId, action.n);
  }
}

/** Focuses, splits, closes, floats or docks panes of the active desktop. */
function paneReducer(state: DesktopsState, action: PaneAction): DesktopsState {
  switch (action.type) {
    case 'focusPane':
      return focusPane(state, action.paneId);
    case 'focusStep':
      return moveFocus(state, action.step);
    case 'split':
      return splitFocused(state, action.dir, action.windowId);
    case 'closePane':
      return closeFocusedPane(state);
    case 'float':
      return floatFocused(state);
    case 'dock':
      return dockFocused(state);
  }
}

/** Whether the action is one of the desktop group. */
function isDesktopAction(action: LayoutAction): action is DesktopAction {
  return DESKTOP_TYPES.has(action.type);
}

/** Whether the action is one of the pane group. */
function isPaneAction(action: LayoutAction): action is PaneAction {
  return PANE_TYPES.has(action.type);
}

/** Whether the action is one of the float group; what is left is the tree group. */
function isFloatAction(action: LayoutAction): action is FloatAction {
  return FLOAT_TYPES.has(action.type);
}

/** Move the desktops along by one action; the same state when nothing changes. */
export function layoutReducer(state: DesktopsState, action: LayoutAction): DesktopsState {
  if (isDesktopAction(action)) {
    return desktopReducer(state, action);
  }
  if (isPaneAction(action)) {
    return paneReducer(state, action);
  }
  if (isFloatAction(action)) {
    return floatReducer(state, action);
  }
  return treeReducer(state, action);
}
