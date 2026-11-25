/**
 * What can happen to the desktops (ARCHITECTURE.md decisions 12 and 18), as
 * plain data: the actions of the layout reducer, in four groups so each
 * group's reducer stays small and its switch stays exhaustive.
 */
import type { DropEdge } from './dropZone';
import type { FocusStep } from './paneFocus';
import type { Direction } from './splitGeometry';
import type { SplitPath } from './splitRatio';
import type { SplitDir } from './splitTree';

/** Actions on the list of desktops. Desktop numbers are 1-based. */
export type DesktopAction =
  | { readonly type: 'goToDesktop'; readonly n: number }
  | { readonly type: 'stepDesktop'; readonly step: 1 | -1 }
  | { readonly type: 'newDesktop' }
  | { readonly type: 'closeDesktop'; readonly n: number }
  | { readonly type: 'pruneDesktops' }
  | { readonly type: 'movePaneToDesktop'; readonly paneId: string; readonly n: number };

/** Actions on the panes of the active desktop. */
export type PaneAction =
  | { readonly type: 'focusPane'; readonly paneId: string }
  | { readonly type: 'focusStep'; readonly step: FocusStep }
  | { readonly type: 'split'; readonly dir: SplitDir; readonly windowId: string }
  | { readonly type: 'closePane' }
  | { readonly type: 'float' }
  | { readonly type: 'dock' }
  | {
      /** Docks a float against the `edge` of a tree pane (a float dragged there). */
      readonly type: 'dockAt';
      readonly floatPaneId: string;
      readonly targetPaneId: string;
      readonly edge: DropEdge;
    };

/** Actions on the floats of the active desktop; sizes are viewport fractions. */
export type FloatAction =
  | {
      readonly type: 'moveFloat';
      readonly paneId: string;
      readonly dx: number;
      readonly dy: number;
    }
  | {
      readonly type: 'resizeFloat';
      readonly paneId: string;
      readonly dw: number;
      readonly dh: number;
    }
  | { readonly type: 'raiseFloat'; readonly paneId: string };

/** Actions on the split tree of the active desktop. */
export type TreeAction =
  | { readonly type: 'setRatio'; readonly path: SplitPath; readonly ratio: number }
  | {
      /** Grows the focused pane along `dir` for a positive `delta`, shrinks it for a negative one. */
      readonly type: 'resizePane';
      readonly dir: SplitDir;
      readonly delta: number;
    }
  | { readonly type: 'equalize' }
  | {
      /** Exchanges the focused pane's window with its neighbour's; focus follows the window. */
      readonly type: 'swap';
      readonly direction: Direction;
    }
  | { readonly type: 'only' };

/** Everything the layout reducer understands. */
export type LayoutAction = DesktopAction | PaneAction | FloatAction | TreeAction;
