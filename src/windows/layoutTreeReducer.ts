/**
 * The layout reducer's float and split-tree groups: transitions that change
 * the floats or the tree of the active desktop. Each returns the state it was
 * handed when nothing changed.
 */
import { onlyDesktopPane } from './desktopOnly';
import type { Desktop } from './desktopPanes';
import { updateActive } from './desktops';
import type { DesktopsState } from './desktops';
import { moveFloat, raiseFloat, resizeFloat } from './floats';
import type { FloatPane, Floats } from './floats';
import type { FloatAction, TreeAction } from './layoutAction';
import { swapFocused } from './paneFocus';
import { equalize, resizePane, setSplitRatio } from './splitRatio';
import type { SplitTree } from './splitTree';

/** A float's pane, window and rectangle as one comparable string. */
function floatKey({ paneId, windowId, rect }: FloatPane): string {
  return `${paneId}:${windowId}:${String(rect.x)},${String(rect.y)},${String(rect.w)},${String(rect.h)}`;
}

/** Whether the two stacks hold the same floats in the same order. */
function sameFloats(a: Floats, b: Floats): boolean {
  return a.map(floatKey).join('|') === b.map(floatKey).join('|');
}

/** The active desktop with its floats replaced by `change(floats)`; unchanged when they come out the same. */
function changeFloats(state: DesktopsState, change: (floats: Floats) => Floats): DesktopsState {
  return updateActive(state, (desktop) => {
    const floats = change(desktop.floats);
    return sameFloats(floats, desktop.floats) ? desktop : { ...desktop, floats };
  });
}

/** The active desktop with its tree replaced by `change(tree, desktop)`; unchanged for an empty or equal tree. */
function changeTree(
  state: DesktopsState,
  change: (tree: SplitTree, desktop: Desktop) => SplitTree,
): DesktopsState {
  return updateActive(state, (desktop) => {
    const tree = desktop.tree === null ? null : change(desktop.tree, desktop);
    return tree === null || tree === desktop.tree ? desktop : { ...desktop, tree };
  });
}

/** Moves, resizes or raises a float of the active desktop. */
export function floatReducer(state: DesktopsState, action: FloatAction): DesktopsState {
  switch (action.type) {
    case 'moveFloat':
      return changeFloats(state, (floats) =>
        moveFloat(floats, action.paneId, action.dx, action.dy),
      );
    case 'resizeFloat':
      return changeFloats(state, (floats) =>
        resizeFloat(floats, action.paneId, action.dw, action.dh),
      );
    case 'raiseFloat':
      return changeFloats(state, (floats) => raiseFloat(floats, action.paneId));
  }
}

/** Sets ratios, resizes, equalizes, swaps or reduces the active desktop to its focused pane. */
export function treeReducer(state: DesktopsState, action: TreeAction): DesktopsState {
  switch (action.type) {
    case 'setRatio':
      return changeTree(state, (tree) => setSplitRatio(tree, action.path, action.ratio));
    case 'resizePane':
      return changeTree(state, (tree, { focusedPaneId }) =>
        focusedPaneId === null ? tree : resizePane(tree, focusedPaneId, action.dir, action.delta),
      );
    case 'equalize':
      return changeTree(state, equalize);
    case 'swap':
      return updateActive(state, (desktop) => swapFocused(desktop, action.direction));
    case 'only':
      return updateActive(state, onlyDesktopPane);
  }
}
