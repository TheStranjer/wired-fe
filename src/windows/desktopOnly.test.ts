/**
 * Tests for onlyDesktopPane: a focused tree pane or float is all that is left,
 * and a desktop with nothing to close is handed back as it was.
 */
import { describe, expect, it } from 'vitest';

import { threePanes, treeShape, withFloats } from './desktopFixtures';
import { onlyDesktopPane } from './desktopOnly';
import { EMPTY_DESKTOP } from './desktopPanes';

/** The ids of a desktop's floats, bottom to top. */
function floatIds(floats: readonly { readonly paneId: string }[]): readonly string[] {
  return floats.map((float) => float.paneId);
}

describe(onlyDesktopPane, () => {
  it('keeps the focused tree pane and drops the rest of the tree', () => {
    const desktop = onlyDesktopPane(threePanes());

    expect(treeShape(desktop)).toBe('p3:w3');
    expect(desktop.focusedPaneId).toBe('p3');
  });

  it('drops the floats when a tree pane has focus', () => {
    const desktop = onlyDesktopPane({ ...withFloats(), focusedPaneId: 'p1' });

    expect(treeShape(desktop)).toBe('p1:w1');
    expect(desktop.floats).toStrictEqual([]);
  });

  it('keeps a focused float alone, dropping the tree and the other floats', () => {
    const desktop = onlyDesktopPane(withFloats());

    expect(desktop.tree).toBeNull();
    expect(floatIds(desktop.floats)).toStrictEqual(['p3']);
    expect(desktop.focusedPaneId).toBe('p3');
  });

  it('returns a desktop with a lone pane as it is', () => {
    const lone = { ...withFloats(), floats: [], focusedPaneId: 'p1' };

    expect(onlyDesktopPane(lone)).toBe(lone);
  });

  it('returns a desktop with a lone float as it is', () => {
    const [, top = null] = withFloats().floats;
    const lone = { tree: null, floats: top === null ? [] : [top], focusedPaneId: 'p3' };

    expect(onlyDesktopPane(lone)).toBe(lone);
  });

  it('returns a desktop with no focus, or an unknown focus, as it is', () => {
    const none = { ...threePanes(), focusedPaneId: null };
    const unknown = { ...threePanes(), focusedPaneId: 'nope' };

    expect(onlyDesktopPane(none)).toBe(none);
    expect(onlyDesktopPane(unknown)).toBe(unknown);
    expect(onlyDesktopPane(EMPTY_DESKTOP)).toBe(EMPTY_DESKTOP);
  });
});
