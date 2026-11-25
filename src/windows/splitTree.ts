/**
 * The split tree of one desktop (ARCHITECTURE.md decision 12): a binary tree
 * whose leaves are panes, each showing one window by id. This module holds the
 * types and the lookups; the transitions that grow or shrink the tree live in
 * splitTreeOps.ts. Pure: every function returns the input unchanged when
 * nothing applies, and pane ids are always passed in, never invented here.
 */

/** How a split lays out its halves: `row` is side by side, `column` is stacked. */
export type SplitDir = 'row' | 'column';

/** A pane: a leaf of the tree, showing the window `windowId`. */
export type PaneLeaf = {
  readonly type: 'pane';
  readonly paneId: string;
  readonly windowId: string;
};

/** A split: two subtrees side by side or stacked; `ratio` is the share of `a`, 0..1. */
export type SplitNode = {
  readonly type: 'split';
  readonly dir: SplitDir;
  readonly ratio: number;
  readonly a: SplitTree;
  readonly b: SplitTree;
};

/** A desktop's layout: one pane, or a split of two subtrees. */
export type SplitTree = PaneLeaf | SplitNode;

/** A tree of the single pane `paneId` showing `windowId`. */
export function singlePane(paneId: string, windowId: string): SplitTree {
  return { type: 'pane', paneId, windowId };
}

/** The pane with this id, or null when the tree has none. */
export function findPane(tree: SplitTree, paneId: string): PaneLeaf | null {
  if (tree.type === 'pane') {
    return tree.paneId === paneId ? tree : null;
  }
  return findPane(tree.a, paneId) ?? findPane(tree.b, paneId);
}

/** Every pane, left to right and top to bottom (the `a` side before the `b` side). */
export function panes(tree: SplitTree): readonly PaneLeaf[] {
  if (tree.type === 'pane') {
    return [tree];
  }
  return [...panes(tree.a), ...panes(tree.b)];
}

/** The panes showing this window, in tree order. */
export function panesShowing(tree: SplitTree, windowId: string): readonly PaneLeaf[] {
  return panes(tree).filter((pane) => pane.windowId === windowId);
}

/**
 * Replaces the pane `paneId` with whatever `change` returns for it. Subtrees
 * that did not change keep their identity; the tree itself is returned as is
 * when no pane matches or `change` hands back the same leaf.
 */
export function mapPane(
  tree: SplitTree,
  paneId: string,
  change: (pane: PaneLeaf) => SplitTree,
): SplitTree {
  if (tree.type === 'pane') {
    return tree.paneId === paneId ? change(tree) : tree;
  }
  const a = mapPane(tree.a, paneId, change);
  const b = a === tree.a ? mapPane(tree.b, paneId, change) : tree.b;
  return a === tree.a && b === tree.b ? tree : { ...tree, a, b };
}

/** Shows another window in the pane `paneId`. */
export function setPaneWindow(tree: SplitTree, paneId: string, windowId: string): SplitTree {
  return mapPane(tree, paneId, (pane) =>
    pane.windowId === windowId ? pane : { ...pane, windowId },
  );
}

/** The tree reduced to the pane `paneId` alone (vim `:only`). */
export function onlyPane(tree: SplitTree, paneId: string): SplitTree {
  return findPane(tree, paneId) ?? tree;
}
