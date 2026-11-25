/**
 * Ratio transitions on the split tree (ARCHITECTURE.md decision 12): set one
 * split's ratio, resize a pane, equalize the whole tree. Pure; each returns
 * the input unchanged when nothing applies.
 */
import { findPane } from './splitTree';
import type { SplitDir, SplitNode, SplitTree } from './splitTree';

/** The smallest share a split gives its `a` side. */
export const MIN_RATIO = 0.1;

/** The largest share a split gives its `a` side. */
export const MAX_RATIO = 0.9;

/** Addresses a split node: the steps from the root, into `a` or `b` at each split. */
export type SplitPath = readonly ('a' | 'b')[];

type Ancestor = { readonly path: SplitPath; readonly side: 'a' | 'b'; readonly node: SplitNode };

function clamp(ratio: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

/**
 * Sets the ratio of the split at `path`, clamped to [MIN_RATIO, MAX_RATIO].
 * Unchanged when the path is unknown or ends at a pane.
 */
export function setSplitRatio(tree: SplitTree, path: SplitPath, ratio: number): SplitTree {
  if (tree.type === 'pane') {
    return tree;
  }
  const [step, ...rest] = path;
  if (step === undefined) {
    const next = clamp(ratio);
    return next === tree.ratio ? tree : { ...tree, ratio: next };
  }
  const child = tree[step];
  const changed = setSplitRatio(child, rest, ratio);
  if (changed === child) {
    return tree;
  }
  return step === 'a' ? { ...tree, a: changed } : { ...tree, b: changed };
}

/**
 * The nearest split above the pane laid out along `dir`: its path, the side
 * the pane is on, and the node. Null when the pane is unknown or has none.
 */
function nearestSplit(tree: SplitTree, paneId: string, dir: SplitDir): Ancestor | null {
  if (tree.type === 'pane') {
    return null;
  }
  const side = findPane(tree.a, paneId) === null ? 'b' : 'a';
  if (findPane(tree[side], paneId) === null) {
    return null;
  }
  const deeper = nearestSplit(tree[side], paneId, dir);
  if (deeper !== null) {
    return { ...deeper, path: [side, ...deeper.path] };
  }
  return tree.dir === dir ? { path: [], side, node: tree } : null;
}

/**
 * The share of its nearest `dir` split the pane has now, 0..1: the ratio on
 * the `a` side, its complement on the `b` side. Null when the pane is unknown
 * or has no such split, i.e. when {@link resizePane} would change nothing.
 */
export function paneShare(tree: SplitTree, paneId: string, dir: SplitDir): number | null {
  const found = nearestSplit(tree, paneId, dir);
  if (found === null) {
    return null;
  }
  return found.side === 'a' ? found.node.ratio : 1 - found.node.ratio;
}

/**
 * Grows the pane along `dir` when `delta` is positive, shrinks it when
 * negative, by moving the ratio of its nearest ancestor split with that `dir`.
 * On the `b` side the ratio moves the other way. Clamped; unchanged when the
 * pane is unknown or has no such ancestor.
 */
export function resizePane(
  tree: SplitTree,
  paneId: string,
  ...change: readonly [dir: SplitDir, delta: number]
): SplitTree {
  const [dir, delta] = change;
  const found = nearestSplit(tree, paneId, dir);
  if (found === null) {
    return tree;
  }
  const signed = found.side === 'a' ? delta : -delta;
  return setSplitRatio(tree, found.path, found.node.ratio + signed);
}

/** How many panes the tree lays out along `dir`: a cross-direction split takes its widest half. */
function extent(tree: SplitTree, dir: SplitDir): number {
  if (tree.type === 'pane') {
    return 1;
  }
  const a = extent(tree.a, dir);
  const b = extent(tree.b, dir);
  return tree.dir === dir ? a + b : Math.max(a, b);
}

/**
 * Sets every ratio so panes share space equally along each split: the share
 * of `a` is its extent over the extent of both, counted along the split's own
 * direction. A subtree split across that direction counts as its widest half,
 * since its halves share the same space.
 */
export function equalize(tree: SplitTree): SplitTree {
  if (tree.type === 'pane') {
    return tree;
  }
  const a = equalize(tree.a);
  const b = equalize(tree.b);
  const ratio = extent(a, tree.dir) / (extent(a, tree.dir) + extent(b, tree.dir));
  return a === tree.a && b === tree.b && ratio === tree.ratio ? tree : { ...tree, a, b, ratio };
}
