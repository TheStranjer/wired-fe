/**
 * Shared test helpers for the split tree: a tree three deep and a compact text
 * form of any tree to assert shapes against.
 */
import type { SplitTree } from './splitTree';
import { singlePane } from './splitTree';
import { splitPane } from './splitTreeOps';

/** `p1:w1` for a pane, `row(a b)` or `col(a b)` for a split; ratios are not shown. */
export function shape(tree: SplitTree): string {
  if (tree.type === 'pane') {
    return `${tree.paneId}:${tree.windowId}`;
  }
  const name = tree.dir === 'row' ? 'row' : 'col';
  return `${name}(${shape(tree.a)} ${shape(tree.b)})`;
}

/** Four panes three splits deep: `row(p1:w1 col(p2:w2 row(p3:w3 p4:w4)))`. */
export function nestedTree(): SplitTree {
  const first = splitPane(singlePane('p1', 'w1'), 'p1', 'row', 'p2', 'w2');
  const second = splitPane(first, 'p2', 'column', 'p3', 'w3');
  return splitPane(second, 'p3', 'row', 'p4', 'w4');
}
