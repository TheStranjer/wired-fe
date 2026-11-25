/**
 * Tests for the pane lookup of one desktop: the pane showing a window found
 * in the tree, among the floats, or not at all.
 */
import { describe, expect, it } from 'vitest';

import type { Desktop } from './desktopPanes';
import { paneShowing } from './shownPanes';
import { singlePane } from './splitTree';

/** One tree pane `p1` showing `a`, and one float `p2` showing `b`. */
const DESKTOP: Desktop = {
  tree: singlePane('p1', 'a'),
  floats: [{ paneId: 'p2', windowId: 'b', rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } }],
  focusedPaneId: 'p1',
};

describe(paneShowing, () => {
  it('finds the tree pane showing a window', () => {
    expect(paneShowing(DESKTOP, 'a')).toBe('p1');
  });

  it('finds the float showing a window', () => {
    expect(paneShowing(DESKTOP, 'b')).toBe('p2');
  });

  it('is null when no pane shows the window', () => {
    expect(paneShowing(DESKTOP, 'c')).toBeNull();
  });
});
