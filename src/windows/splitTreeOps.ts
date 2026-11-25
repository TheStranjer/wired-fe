/**
 * Transitions that change the shape of a desktop's split tree: split a pane,
 * close one, swap the windows of two. Pure; each returns the input unchanged
 * when nothing applies (unknown id, id already taken, nothing to exchange).
 */
import { findPane, mapPane, setPaneWindow } from './splitTree';
import type { SplitDir, SplitTree } from './splitTree';

/** The share of `a` in a fresh split. */
const NEW_SPLIT_RATIO = 0.5;

/**
 * Splits the pane `paneId` in direction `dir`: the old pane stays as `a` and a
 * new pane `newPaneId` showing `newWindowId` becomes `b`. Unchanged when
 * `paneId` is unknown or `newPaneId` is already in the tree.
 */
export function splitPane(
  tree: SplitTree,
  paneId: string,
  ...added: readonly [dir: SplitDir, newPaneId: string, newWindowId: string]
): SplitTree {
  const [dir, newPaneId, newWindowId] = added;
  if (findPane(tree, newPaneId) !== null) {
    return tree;
  }
  return mapPane(tree, paneId, (pane) => ({
    type: 'split',
    dir,
    ratio: NEW_SPLIT_RATIO,
    a: pane,
    b: { type: 'pane', paneId: newPaneId, windowId: newWindowId },
  }));
}

/**
 * Removes the pane `paneId`; its sibling takes the parent's place. Null when
 * the last pane closes; unchanged when the id is unknown.
 */
export function closePane(tree: SplitTree, paneId: string): SplitTree | null {
  if (tree.type === 'pane') {
    return tree.paneId === paneId ? null : tree;
  }
  const a = closePane(tree.a, paneId);
  if (a === null) {
    return tree.b;
  }
  if (a !== tree.a) {
    return { ...tree, a };
  }
  const b = closePane(tree.b, paneId);
  if (b === null) {
    return tree.a;
  }
  return b === tree.b ? tree : { ...tree, b };
}

/** Exchanges the windows shown by two panes; the layout itself does not move. */
export function swapPanes(tree: SplitTree, paneIdA: string, paneIdB: string): SplitTree {
  const first = findPane(tree, paneIdA);
  const second = findPane(tree, paneIdB);
  if (first === null || second === null || first.windowId === second.windowId) {
    return tree;
  }
  const swapped = setPaneWindow(tree, paneIdA, second.windowId);
  return setPaneWindow(swapped, paneIdB, first.windowId);
}
