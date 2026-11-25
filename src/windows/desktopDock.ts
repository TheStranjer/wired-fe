/**
 * The `dockAt` transition on a single desktop (ARCHITECTURE.md decision 12): a
 * float joins the split tree beside a chosen pane, on the chosen edge. Pure:
 * the desktop comes back unchanged when the float or the target is unknown.
 */
import type { Desktop } from './desktopPanes';
import type { DropEdge } from './dropZone';
import { findFloat, removeFloat } from './floats';
import { findPane } from './splitTree';
import type { SplitDir } from './splitTree';
import { splitPaneAt } from './splitTreeOps';

/** The split direction a dock edge makes: left and right sit side by side. */
function dirOf(edge: DropEdge): SplitDir {
  return edge === 'left' || edge === 'right' ? 'row' : 'column';
}

/**
 * Removes the float `floatPaneId` and splits the tree pane `targetPaneId` with
 * it: `row` for left and right, `column` for top and bottom, the float's pane in
 * `a` for left and top, in `b` for right and bottom. The docked pane gets focus.
 */
export function dockDesktopPaneAt(
  desktop: Desktop,
  floatPaneId: string,
  ...target: readonly [targetPaneId: string, edge: DropEdge]
): Desktop {
  const [targetPaneId, edge] = target;
  const float = findFloat(desktop.floats, floatPaneId);
  const { tree } = desktop;
  if (float === null || tree === null || findPane(tree, targetPaneId) === null) {
    return desktop;
  }
  const first = edge === 'left' || edge === 'top';
  const docked = splitPaneAt(tree, targetPaneId, first, dirOf(edge), float.paneId, float.windowId);
  return {
    tree: docked,
    floats: removeFloat(desktop.floats, float.paneId),
    focusedPaneId: float.paneId,
  };
}
