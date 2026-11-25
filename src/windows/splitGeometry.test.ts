/**
 * The split tree geometry: pane rectangles and the neighbour in a direction.
 */
import { describe, expect, it } from 'vitest';

import type { Direction } from './splitGeometry';
import { neighbour, paneRects } from './splitGeometry';
import type { SplitDir, SplitTree } from './splitTree';
import { singlePane } from './splitTree';
import { splitPane } from './splitTreeOps';

const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

function leaf(id: string): SplitTree {
  return singlePane(id, `w-${id}`);
}

function split(dir: SplitDir, ratio: number, ...[a, b]: [SplitTree, SplitTree]): SplitTree {
  return { type: 'split', dir, ratio, a, b };
}

/** `row(col(p1 p3) col(p2 p4))`: a 2x2 grid built from splits. */
function grid(): SplitTree {
  const right = splitPane(leaf('p1'), 'p1', 'row', 'p2', 'w-p2');
  const left = splitPane(right, 'p1', 'column', 'p3', 'w-p3');
  return splitPane(left, 'p2', 'column', 'p4', 'w-p4');
}

function around(tree: SplitTree, paneId: string): Record<Direction, string | null> {
  return {
    left: neighbour(tree, paneId, 'left'),
    right: neighbour(tree, paneId, 'right'),
    up: neighbour(tree, paneId, 'up'),
    down: neighbour(tree, paneId, 'down'),
  };
}

describe(paneRects, () => {
  it('gives a single pane the whole desktop', () => {
    expect(paneRects(leaf('p1'))).toStrictEqual(new Map([['p1', { x: 0, y: 0, w: 1, h: 1 }]]));
  });

  it('divides width for row splits and height for column splits', () => {
    expect(paneRects(grid())).toStrictEqual(
      new Map([
        ['p1', { x: 0, y: 0, w: 0.5, h: 0.5 }],
        ['p3', { x: 0, y: 0.5, w: 0.5, h: 0.5 }],
        ['p2', { x: 0.5, y: 0, w: 0.5, h: 0.5 }],
        ['p4', { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }],
      ]),
    );
  });

  it('honours uneven ratios', () => {
    const tree = split('row', 0.25, leaf('a'), split('column', 0.75, leaf('b'), leaf('c')));

    expect(paneRects(tree)).toStrictEqual(
      new Map([
        ['a', { x: 0, y: 0, w: 0.25, h: 1 }],
        ['b', { x: 0.25, y: 0, w: 0.75, h: 0.75 }],
        ['c', { x: 0.25, y: 0.75, w: 0.75, h: 0.25 }],
      ]),
    );
  });
});

describe(neighbour, () => {
  it('is null in every direction for a single pane', () => {
    for (const direction of DIRECTIONS) {
      expect(neighbour(leaf('p1'), 'p1', direction)).toBeNull();
    }
  });

  it('walks a 2x2 grid, with null at the desktop edge and no diagonals or wrapping', () => {
    const tree = grid();

    expect(around(tree, 'p1')).toStrictEqual({ left: null, right: 'p2', up: null, down: 'p3' });
    expect(around(tree, 'p2')).toStrictEqual({ left: 'p1', right: null, up: null, down: 'p4' });
    expect(around(tree, 'p3')).toStrictEqual({ left: null, right: 'p4', up: 'p1', down: null });
    expect(around(tree, 'p4')).toStrictEqual({ left: 'p3', right: null, up: 'p2', down: null });
  });

  it('picks the larger overlap when it comes first or last in tree order', () => {
    const firstBigger = split('row', 0.5, leaf('a'), split('column', 0.75, leaf('b'), leaf('c')));
    const lastBigger = split('row', 0.5, leaf('a'), split('column', 0.25, leaf('b'), leaf('c')));

    expect(neighbour(firstBigger, 'a', 'right')).toBe('b');
    expect(neighbour(lastBigger, 'a', 'right')).toBe('c');
  });

  it('breaks an overlap tie towards the top-left', () => {
    const tall = split('row', 0.5, leaf('a'), split('column', 0.5, leaf('b'), leaf('c')));
    const wide = split('column', 0.5, split('row', 0.5, leaf('a'), leaf('b')), leaf('c'));
    const flipped = split('row', 0.5, split('column', 0.5, leaf('b'), leaf('c')), leaf('a'));
    const below = split('column', 0.5, leaf('c'), split('row', 0.5, leaf('a'), leaf('b')));

    expect(neighbour(tall, 'a', 'right')).toBe('b');
    expect(neighbour(wide, 'c', 'up')).toBe('a');
    expect(neighbour(flipped, 'a', 'left')).toBe('b');
    expect(neighbour(below, 'c', 'down')).toBe('a');
  });

  it('finds the single pane that spans a split on the other side', () => {
    const tree = split('row', 0.5, leaf('a'), split('column', 0.25, leaf('b'), leaf('c')));

    expect(around(tree, 'b')).toStrictEqual({ left: 'a', right: null, up: null, down: 'c' });
    expect(around(tree, 'c')).toStrictEqual({ left: 'a', right: null, up: 'b', down: null });
  });

  it('follows uneven ratios', () => {
    const tree = split(
      'row',
      0.25,
      split('column', 0.25, leaf('a'), leaf('b')),
      split('column', 0.75, leaf('c'), leaf('d')),
    );

    expect(around(tree, 'a')).toStrictEqual({ left: null, right: 'c', up: null, down: 'b' });
    expect(around(tree, 'b')).toStrictEqual({ left: null, right: 'c', up: 'a', down: null });
    expect(around(tree, 'c')).toStrictEqual({ left: 'b', right: null, up: null, down: 'd' });
    expect(around(tree, 'd')).toStrictEqual({ left: 'b', right: null, up: 'c', down: null });
  });

  it('is null for an unknown pane id', () => {
    for (const direction of DIRECTIONS) {
      expect(neighbour(grid(), 'nope', direction)).toBeNull();
    }
  });
});
