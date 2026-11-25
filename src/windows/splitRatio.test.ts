/**
 * The split ratio transitions: setting a ratio by path, resizing a pane and
 * equalizing a tree.
 */
import { describe, expect, it } from 'vitest';

import { MAX_RATIO, MIN_RATIO, equalize, resizePane, setSplitRatio } from './splitRatio';
import type { SplitPath } from './splitRatio';
import { singlePane } from './splitTree';
import type { SplitTree } from './splitTree';
import { nestedTree, shape } from './splitTreeFixtures';
import { splitPane } from './splitTreeOps';

/** The ratio of the split at `path`, or null when the path does not end at a split. */
function ratioAt(tree: SplitTree, path: SplitPath): number | null {
  const [step, ...rest] = path;
  if (tree.type === 'pane') {
    return null;
  }
  return step === undefined ? tree.ratio : ratioAt(tree[step], rest);
}

/** `row(p1 row(p2 p3))`: one pane, then two more nested on the `b` side. */
function unbalanced(): SplitTree {
  const first = splitPane(singlePane('p1', 'w1'), 'p1', 'row', 'p2', 'w2');
  return splitPane(first, 'p2', 'row', 'p3', 'w3');
}

describe('constants', () => {
  it('bounds the ratio', () => {
    expect(MIN_RATIO).toBe(0.1);
    expect(MAX_RATIO).toBe(0.9);
  });
});

describe(setSplitRatio, () => {
  it('sets the root ratio', () => {
    expect(ratioAt(setSplitRatio(nestedTree(), [], 0.3), [])).toBe(0.3);
  });

  it('sets a nested ratio and leaves the others alone', () => {
    const tree = setSplitRatio(nestedTree(), ['b', 'b'], 0.7);

    expect(ratioAt(tree, ['b', 'b'])).toBe(0.7);
    expect(ratioAt(tree, [])).toBe(0.5);
    expect(ratioAt(tree, ['b'])).toBe(0.5);
    expect(shape(tree)).toBe(shape(nestedTree()));
  });

  it('sets a ratio under the a side', () => {
    const base = splitPane(nestedTree(), 'p1', 'column', 'p5', 'w5');
    const tree = setSplitRatio(base, ['a'], 0.4);

    expect(ratioAt(tree, ['a'])).toBe(0.4);
    expect(ratioAt(tree, [])).toBe(0.5);
  });

  it('clamps at both ends', () => {
    expect(ratioAt(setSplitRatio(nestedTree(), [], 0), [])).toBe(MIN_RATIO);
    expect(ratioAt(setSplitRatio(nestedTree(), [], -4), [])).toBe(MIN_RATIO);
    expect(ratioAt(setSplitRatio(nestedTree(), [], 1), [])).toBe(MAX_RATIO);
    expect(ratioAt(setSplitRatio(nestedTree(), [], 7), [])).toBe(MAX_RATIO);
  });

  it('returns the same tree when the clamped ratio is already set', () => {
    const tree = nestedTree();

    expect(setSplitRatio(tree, [], 0.5)).toBe(tree);
  });

  it('returns the same tree for a path past the tree', () => {
    const tree = nestedTree();

    expect(setSplitRatio(tree, ['a'], 0.3)).toBe(tree);
    expect(setSplitRatio(tree, ['b', 'b', 'a', 'a'], 0.3)).toBe(tree);
    expect(setSplitRatio(tree, ['b', 'b', 'b', 'a'], 0.3)).toBe(tree);
  });

  it('returns the same tree for a path ending at a pane', () => {
    const tree = nestedTree();

    expect(setSplitRatio(tree, ['a'], 0.3)).toBe(tree);
    expect(setSplitRatio(tree, ['b', 'b', 'a'], 0.3)).toBe(tree);
    expect(setSplitRatio(singlePane('p1', 'w1'), [], 0.3)).toStrictEqual(singlePane('p1', 'w1'));
  });
});

describe(resizePane, () => {
  it('grows a pane on the a side by raising the ratio', () => {
    expect(ratioAt(resizePane(nestedTree(), 'p1', 'row', 0.1), [])).toBeCloseTo(0.6);
  });

  it('shrinks a pane on the a side by lowering the ratio', () => {
    expect(ratioAt(resizePane(nestedTree(), 'p1', 'row', -0.2), [])).toBeCloseTo(0.3);
  });

  it('grows a pane on the b side by lowering the ratio', () => {
    expect(ratioAt(resizePane(nestedTree(), 'p3', 'column', 0.1), ['b'])).toBeCloseTo(0.4);
  });

  it('shrinks a pane on the b side by raising the ratio', () => {
    expect(ratioAt(resizePane(nestedTree(), 'p4', 'row', -0.2), ['b', 'b'])).toBeCloseTo(0.7);
  });

  it('clamps at both ends', () => {
    expect(ratioAt(resizePane(nestedTree(), 'p1', 'row', 5), [])).toBe(MAX_RATIO);
    expect(ratioAt(resizePane(nestedTree(), 'p1', 'row', -5), [])).toBe(MIN_RATIO);
    expect(ratioAt(resizePane(nestedTree(), 'p4', 'row', 5), ['b', 'b'])).toBe(MIN_RATIO);
  });

  it('uses the nearest ancestor with the direction, skipping others', () => {
    const tree = resizePane(nestedTree(), 'p4', 'column', 0.1);

    expect(ratioAt(tree, ['b'])).toBeCloseTo(0.4);
    expect(ratioAt(tree, ['b', 'b'])).toBe(0.5);
    expect(ratioAt(tree, [])).toBe(0.5);
  });

  it('uses the nearest of several ancestors with the same direction', () => {
    const tree = resizePane(unbalanced(), 'p3', 'row', 0.2);

    expect(ratioAt(tree, ['b'])).toBeCloseTo(0.3);
    expect(ratioAt(tree, [])).toBe(0.5);
  });

  it('reaches an outer ancestor past an inner split of another direction', () => {
    const tree = resizePane(nestedTree(), 'p2', 'row', 0.2);

    expect(ratioAt(tree, [])).toBeCloseTo(0.3);
    expect(ratioAt(tree, ['b'])).toBe(0.5);
  });

  it('returns the same tree when no ancestor has the direction', () => {
    const tree = nestedTree();

    expect(resizePane(tree, 'p1', 'column', 0.1)).toBe(tree);
    expect(resizePane(singlePane('p1', 'w1'), 'p1', 'row', 0.1)).toStrictEqual(
      singlePane('p1', 'w1'),
    );
  });

  it('returns the same tree for an unknown pane', () => {
    const tree = nestedTree();

    expect(resizePane(tree, 'nope', 'row', 0.1)).toBe(tree);
  });

  it('returns the same tree for a zero delta', () => {
    const tree = nestedTree();

    expect(resizePane(tree, 'p1', 'row', 0)).toBe(tree);
  });
});

describe(equalize, () => {
  it('shares an unbalanced three-pane row equally', () => {
    const tree = equalize(setSplitRatio(unbalanced(), [], 0.8));

    expect(ratioAt(tree, [])).toBeCloseTo(1 / 3);
    expect(ratioAt(tree, ['b'])).toBe(0.5);
  });

  it('gives more room to the a side when it holds more panes', () => {
    const tree = equalize(splitPane(unbalanced(), 'p1', 'row', 'p4', 'w4'));

    expect(ratioAt(tree, [])).toBeCloseTo(0.5);
    expect(ratioAt(tree, ['a'])).toBe(0.5);
  });

  it('counts a cross-direction subtree as its widest half', () => {
    const tree = equalize(setSplitRatio(nestedTree(), [], 0.2));

    expect(ratioAt(tree, [])).toBeCloseTo(1 / 3);
    expect(ratioAt(tree, ['b'])).toBeCloseTo(1 / 2);
    expect(ratioAt(tree, ['b', 'b'])).toBe(0.5);
  });

  it('weighs stacked panes by their own direction', () => {
    const column = splitPane(unbalanced(), 'p1', 'column', 'p4', 'w4');
    const tree = equalize(setSplitRatio(column, ['a'], 0.9));

    expect(ratioAt(tree, ['a'])).toBe(0.5);
    expect(ratioAt(tree, [])).toBeCloseTo(1 / 3);
  });

  it('returns the same tree when already equal', () => {
    const tree = equalize(unbalanced());

    expect(equalize(tree)).toBe(tree);
  });

  it('returns a single pane as is', () => {
    const tree = singlePane('p1', 'w1');

    expect(equalize(tree)).toBe(tree);
  });

  it('keeps the shape', () => {
    expect(shape(equalize(nestedTree()))).toBe(shape(nestedTree()));
  });
});
