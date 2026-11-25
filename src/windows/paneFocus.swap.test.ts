/**
 * Tests for swapping the focused pane with its neighbour (decision 12): the
 * windows exchange and focus follows the window, in every direction of a 2×2
 * grid, and nothing happens at an edge or from a float.
 */
import { describe, expect, it } from 'vitest';

import { treeOf } from './desktopFixtures';
import { activeDesktop, initialDesktops, splitFocused, updateActive } from './desktops';
import { swapFocused } from './paneFocus';
import { MIDDLE, focusOn, grid, withFloat } from './paneFocusFixtures';

describe(swapFocused, () => {
  it('exchanges the windows of the focused pane and its neighbour, and focus follows the window', () => {
    const state = updateActive(focusOn(grid(), 'p1'), (desktop) => swapFocused(desktop, 'right'));

    expect(treeOf(state, 1)).toBe('row(col(p1:w2 p4:w3) col(p2:w1 p3:w4))');
    expect(activeDesktop(state).focusedPaneId).toBe('p2');
  });

  it('works in every direction of the grid', () => {
    const down = updateActive(focusOn(grid(), 'p2'), (desktop) => swapFocused(desktop, 'down'));
    const left = updateActive(focusOn(grid(), 'p3'), (desktop) => swapFocused(desktop, 'left'));
    const up = updateActive(focusOn(grid(), 'p4'), (desktop) => swapFocused(desktop, 'up'));

    expect(treeOf(down, 1)).toBe('row(col(p1:w1 p4:w3) col(p2:w4 p3:w2))');
    expect(treeOf(left, 1)).toBe('row(col(p1:w1 p4:w4) col(p2:w2 p3:w3))');
    expect(treeOf(up, 1)).toBe('row(col(p1:w3 p4:w1) col(p2:w2 p3:w4))');
  });

  it('changes nothing at an edge', () => {
    const desktop = activeDesktop(focusOn(grid(), 'p1'));

    expect(swapFocused(desktop, 'left')).toBe(desktop);
  });

  it('changes nothing from a float, with no focus or without a tree', () => {
    const floating = activeDesktop(withFloat(grid(), 'p9', MIDDLE));
    const none = activeDesktop(focusOn(grid(), null));
    const bare = { ...floating, tree: null };

    expect(swapFocused(floating, 'left')).toBe(floating);
    expect(swapFocused(none, 'left')).toBe(none);
    expect(swapFocused(bare, 'left')).toBe(bare);
  });

  it('changes nothing when both panes show the same window', () => {
    const same = splitFocused(initialDesktops('w1'), 'row', 'w1');
    const desktop = activeDesktop(same);

    expect(swapFocused(desktop, 'left')).toBe(desktop);
  });
});
