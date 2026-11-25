/**
 * Split tree transitions: splitting a pane, closing a pane in every position,
 * and swapping the windows of two panes.
 */
import { describe, expect, it } from 'vitest';

import { singlePane } from './splitTree';
import type { SplitNode, SplitTree } from './splitTree';
import { nestedTree, shape } from './splitTreeFixtures';
import { closePane, splitPane, swapPanes } from './splitTreeOps';

/** The shape of a tree after closing a pane, `gone` when that closed the last pane. */
function shapeAfterClose(tree: SplitTree, paneId: string): string {
  const closed = closePane(tree, paneId);
  return closed === null ? 'gone' : shape(closed);
}

describe(splitPane, () => {
  it('splits a single pane, the old pane as a and the new one as b, at ratio 0.5', () => {
    const expected: SplitNode = {
      type: 'split',
      dir: 'row',
      ratio: 0.5,
      a: { type: 'pane', paneId: 'p1', windowId: 'w1' },
      b: { type: 'pane', paneId: 'p2', windowId: 'w2' },
    };

    expect(splitPane(singlePane('p1', 'w1'), 'p1', 'row', 'p2', 'w2')).toStrictEqual(expected);
  });

  it('stacks panes for column', () => {
    expect(shape(splitPane(singlePane('p1', 'w1'), 'p1', 'column', 'p2', 'w2'))).toBe(
      'col(p1:w1 p2:w2)',
    );
  });

  it('builds a tree three deep', () => {
    expect(shape(nestedTree())).toBe('row(p1:w1 col(p2:w2 row(p3:w3 p4:w4)))');
  });

  it('splits a pane in the first half of a split', () => {
    expect(shape(splitPane(nestedTree(), 'p1', 'column', 'p5', 'w5'))).toBe(
      'row(col(p1:w1 p5:w5) col(p2:w2 row(p3:w3 p4:w4)))',
    );
  });

  it('returns the same tree for an unknown pane or a pane id already in use', () => {
    const tree = nestedTree();

    expect(splitPane(tree, 'nope', 'row', 'p5', 'w5')).toBe(tree);
    expect(splitPane(tree, 'p1', 'row', 'p4', 'w5')).toBe(tree);
  });
});

describe(closePane, () => {
  it('is null when the last pane closes', () => {
    expect(closePane(singlePane('p1', 'w1'), 'p1')).toBeNull();
  });

  it('keeps a single pane when the id is unknown', () => {
    const tree = singlePane('p1', 'w1');

    expect(closePane(tree, 'nope')).toBe(tree);
  });

  it('lets the sibling take the parent place, closing a or b', () => {
    const tree = splitPane(singlePane('p1', 'w1'), 'p1', 'row', 'p2', 'w2');

    expect(closePane(tree, 'p1')).toStrictEqual(singlePane('p2', 'w2'));
    expect(closePane(tree, 'p2')).toStrictEqual(singlePane('p1', 'w1'));
  });

  it('closes the first pane of a nested tree', () => {
    expect(shapeAfterClose(nestedTree(), 'p1')).toBe('col(p2:w2 row(p3:w3 p4:w4))');
  });

  it('closes a pane in the middle of a nested tree', () => {
    expect(shapeAfterClose(nestedTree(), 'p2')).toBe('row(p1:w1 row(p3:w3 p4:w4))');
  });

  it('closes the deepest panes, a side and b side', () => {
    expect(shapeAfterClose(nestedTree(), 'p3')).toBe('row(p1:w1 col(p2:w2 p4:w4))');
    expect(shapeAfterClose(nestedTree(), 'p4')).toBe('row(p1:w1 col(p2:w2 p3:w3))');
  });

  it('closes a pane inside a split that is the first half', () => {
    const tree = splitPane(nestedTree(), 'p1', 'column', 'p5', 'w5');

    expect(shapeAfterClose(tree, 'p5')).toBe('row(p1:w1 col(p2:w2 row(p3:w3 p4:w4)))');
    expect(shapeAfterClose(tree, 'p3')).toBe('row(col(p1:w1 p5:w5) col(p2:w2 p4:w4))');
  });

  it('returns the same tree for an unknown id', () => {
    const tree = nestedTree();

    expect(closePane(tree, 'nope')).toBe(tree);
  });
});

describe(swapPanes, () => {
  it('swaps the windows of two panes in the same split', () => {
    const tree = splitPane(singlePane('p1', 'w1'), 'p1', 'row', 'p2', 'w2');

    expect(shape(swapPanes(tree, 'p1', 'p2'))).toBe('row(p1:w2 p2:w1)');
  });

  it('swaps across subtrees and leaves the layout alone', () => {
    expect(shape(swapPanes(nestedTree(), 'p1', 'p4'))).toBe(
      'row(p1:w4 col(p2:w2 row(p3:w3 p4:w1)))',
    );
    expect(shape(swapPanes(nestedTree(), 'p3', 'p2'))).toBe(
      'row(p1:w1 col(p2:w3 row(p3:w2 p4:w4)))',
    );
  });

  it('returns the same tree for an unknown id, the same pane twice or equal windows', () => {
    const tree = nestedTree();

    expect(swapPanes(tree, 'p1', 'nope')).toBe(tree);
    expect(swapPanes(tree, 'nope', 'p1')).toBe(tree);
    expect(swapPanes(tree, 'p1', 'p1')).toBe(tree);
  });
});
