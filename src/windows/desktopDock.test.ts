/**
 * Tests for docking a float against a pane edge (WFE-231): each edge splits
 * the target the right way round, the float leaves the floats and takes focus,
 * and unknown ids change nothing.
 */
import { describe, expect, it } from 'vitest';

import { RECT, treeOf, twoPanes } from './desktopFixtures';
import { activeDesktop, dockAt } from './desktops';
import type { DesktopsState } from './desktops';
import type { DropEdge } from './dropZone';
import { addFloat } from './floats';

/** `row(p1:w1 p2:w2)` with the float f1 showing w3 above it, focus on f1. */
function floating(): DesktopsState {
  const state = twoPanes();
  const desktop = activeDesktop(state);
  return {
    ...state,
    desktops: [{ ...desktop, floats: addFloat([], 'f1', 'w3', RECT), focusedPaneId: 'f1' }],
  };
}

describe(dockAt, () => {
  it.each<readonly [DropEdge, string]>([
    ['left', 'row(row(f1:w3 p1:w1) p2:w2)'],
    ['right', 'row(row(p1:w1 f1:w3) p2:w2)'],
    ['top', 'row(col(f1:w3 p1:w1) p2:w2)'],
    ['bottom', 'row(col(p1:w1 f1:w3) p2:w2)'],
  ])('docks on the %s of the target', (edge, shape) => {
    const state = dockAt(floating(), 'f1', 'p1', edge);

    expect(treeOf(state, 1)).toBe(shape);
    expect(activeDesktop(state).floats).toStrictEqual([]);
    expect(activeDesktop(state).focusedPaneId).toBe('f1');
  });

  it('splits the target in half', () => {
    const { tree } = activeDesktop(dockAt(floating(), 'f1', 'p2', 'right'));

    expect(tree?.type === 'split' && tree.b.type === 'split' ? tree.b.ratio : null).toBe(0.5);
  });

  it('changes nothing for an unknown float', () => {
    const state = floating();

    expect(dockAt(state, 'nope', 'p1', 'left')).toBe(state);
  });

  it('changes nothing for a target that is not in the tree', () => {
    const state = floating();

    expect(dockAt(state, 'f1', 'nope', 'left')).toBe(state);
  });

  it('changes nothing for a tree pane given as the float', () => {
    const state = floating();

    expect(dockAt(state, 'p1', 'p2', 'left')).toBe(state);
  });

  it('changes nothing on a desktop without a tree', () => {
    const state = floating();
    const desktop = activeDesktop(state);
    const bare = { ...state, desktops: [{ ...desktop, tree: null }] };

    expect(dockAt(bare, 'f1', 'p1', 'left')).toBe(bare);
  });
});
