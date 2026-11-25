/**
 * Tests for dock drop zones (WFE-231): the nearest edge of a pane rectangle,
 * the half it claims, and the pane under a point of a split tree.
 */
import { describe, expect, it } from 'vitest';

import { dropTarget, dropZone, zoneRect } from './dropZone';
import type { DropEdge, Point } from './dropZone';
import type { Rect } from './splitGeometry';
import { singlePane } from './splitTree';
import { splitPane } from './splitTreeOps';

const PANE: Rect = { x: 0.5, y: 0, w: 0.5, h: 1 };

describe(dropZone, () => {
  it.each<{ readonly name: string; readonly at: Point; readonly edge: DropEdge }>([
    { name: 'near the left edge', at: { x: 0.55, y: 0.5 }, edge: 'left' },
    { name: 'near the right edge', at: { x: 0.95, y: 0.5 }, edge: 'right' },
    { name: 'near the top edge', at: { x: 0.75, y: 0.1 }, edge: 'top' },
    { name: 'near the bottom edge', at: { x: 0.75, y: 0.9 }, edge: 'bottom' },
    { name: 'in the top-left corner', at: { x: 0.52, y: 0.02 }, edge: 'top' },
    { name: 'in the bottom-right corner', at: { x: 0.99, y: 0.9 }, edge: 'right' },
    { name: 'at the exact middle (ties go left)', at: { x: 0.75, y: 0.5 }, edge: 'left' },
  ])('$name', ({ at, edge }) => {
    expect(dropZone(PANE, at)).toBe(edge);
  });
});

describe(zoneRect, () => {
  it.each<readonly [DropEdge, Rect]>([
    ['left', { x: 0.5, y: 0, w: 0.25, h: 1 }],
    ['right', { x: 0.75, y: 0, w: 0.25, h: 1 }],
    ['top', { x: 0.5, y: 0, w: 0.5, h: 0.5 }],
    ['bottom', { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }],
  ])('the %s half', (edge, expected) => {
    expect(zoneRect(PANE, edge)).toStrictEqual(expected);
  });
});

describe(dropTarget, () => {
  const tree = splitPane(singlePane('p1', 'w1'), 'p1', 'row', 'p2', 'w2');

  it('finds the pane under the point, its nearest edge and that half', () => {
    expect(dropTarget(tree, { x: 0.9, y: 0.5 })).toStrictEqual({
      paneId: 'p2',
      edge: 'right',
      zone: { x: 0.75, y: 0, w: 0.25, h: 1 },
    });
  });

  it('finds the first pane for a point in it', () => {
    expect(dropTarget(tree, { x: 0.1, y: 0.5 })?.paneId).toBe('p1');
  });

  it('is null for a point outside every pane', () => {
    expect(dropTarget(tree, { x: 1.5, y: 0.5 })).toBeNull();
  });

  it('is null for an empty tree', () => {
    expect(dropTarget(null, { x: 0.5, y: 0.5 })).toBeNull();
  });
});
