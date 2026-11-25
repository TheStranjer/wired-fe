/**
 * Pane-level changes on one desktop: float, dock, removal with focus
 * fallbacks and insertion of a pane from elsewhere.
 */
import { describe, expect, it } from 'vitest';

import { RECT, threePanes, treeShape, withFloats } from './desktopFixtures';
import {
  EMPTY_DESKTOP,
  dockDesktopPane,
  floatDesktopPane,
  insertDesktopPane,
  removeDesktopPane,
  splitDesktop,
} from './desktopPanes';
import { addFloat } from './floats';

describe(floatDesktopPane, () => {
  it('moves the focused tree pane into a float with the same id', () => {
    const floated = floatDesktopPane(threePanes());

    expect(treeShape(floated)).toBe('row(p1:w1 p2:w2)');
    expect(floated.floats).toHaveLength(1);
    expect(floated.floats[0]?.paneId).toBe('p3');
    expect(floated.floats[0]?.windowId).toBe('w3');
    expect(floated.focusedPaneId).toBe('p3');
  });

  it('leaves an empty tree when the only pane floats', () => {
    const floated = floatDesktopPane(splitDesktop(EMPTY_DESKTOP, 'row', 'p1', 'w1'));

    expect(floated.tree).toBeNull();
    expect(floated.floats).toHaveLength(1);
  });

  it('is unchanged on an empty desktop, with no focus or when a float has focus', () => {
    const unfocused = { ...threePanes(), focusedPaneId: null };
    const floating = withFloats();

    expect(floatDesktopPane(EMPTY_DESKTOP)).toBe(EMPTY_DESKTOP);
    expect(floatDesktopPane(unfocused)).toBe(unfocused);
    expect(floatDesktopPane(floating)).toBe(floating);
  });
});

describe(dockDesktopPane, () => {
  it('docks the focused float as a row split beside the last tree pane', () => {
    const docked = dockDesktopPane(withFloats());

    expect(treeShape(docked)).toBe('row(p1:w1 p3:w3)');
    expect(docked.floats.map((float) => float.paneId)).toStrictEqual(['p2']);
    expect(docked.focusedPaneId).toBe('p3');
  });

  it('docks into an empty tree as the only pane', () => {
    const floated = floatDesktopPane(splitDesktop(EMPTY_DESKTOP, 'row', 'p1', 'w1'));

    expect(treeShape(dockDesktopPane(floated))).toBe('p1:w1');
  });

  it('is unchanged when no float has focus', () => {
    const desktop = threePanes();

    expect(dockDesktopPane(desktop)).toBe(desktop);
    expect(dockDesktopPane(EMPTY_DESKTOP)).toBe(EMPTY_DESKTOP);
  });
});

describe(removeDesktopPane, () => {
  it('focuses the sibling that took the place of a closed focused pane', () => {
    const closed = removeDesktopPane(threePanes(), 'p3');

    expect(treeShape(closed)).toBe('row(p1:w1 p2:w2)');
    expect(closed.focusedPaneId).toBe('p2');
  });

  it('focuses the first pane of a sibling subtree, and the other side too', () => {
    const first = removeDesktopPane({ ...threePanes(), focusedPaneId: 'p1' }, 'p1');
    const last = removeDesktopPane(splitDesktop(first, 'row', 'p4', 'w4'), 'p4');

    expect(treeShape(first)).toBe('col(p2:w2 p3:w3)');
    expect(first.focusedPaneId).toBe('p2');
    expect(last.focusedPaneId).toBe('p2');
  });

  it('keeps the focus when another pane closes', () => {
    const closed = removeDesktopPane(threePanes(), 'p2');

    expect(treeShape(closed)).toBe('row(p1:w1 p3:w3)');
    expect(closed.focusedPaneId).toBe('p3');
  });

  it('focuses the topmost float when the last tree pane closes, else nothing', () => {
    const single = splitDesktop(EMPTY_DESKTOP, 'row', 'p1', 'w1');
    const floating = { ...withFloats(), focusedPaneId: 'p1' };

    expect(removeDesktopPane(floating, 'p1').focusedPaneId).toBe('p3');
    expect(removeDesktopPane(single, 'p1')).toStrictEqual(EMPTY_DESKTOP);
  });

  it('removes a focused float and focuses the next topmost float', () => {
    const closed = removeDesktopPane(withFloats(), 'p3');

    expect(closed.floats.map((float) => float.paneId)).toStrictEqual(['p2']);
    expect(closed.focusedPaneId).toBe('p2');
  });

  it('falls back from the last float to the first tree pane, else nothing', () => {
    const floats = addFloat([], 'p2', 'w2', RECT);
    const lone = { ...withFloats(), floats, focusedPaneId: 'p2' };
    const treeless = { ...EMPTY_DESKTOP, floats, focusedPaneId: 'p2' };

    expect(removeDesktopPane(lone, 'p2').focusedPaneId).toBe('p1');
    expect(removeDesktopPane(treeless, 'p2')).toStrictEqual(EMPTY_DESKTOP);
  });

  it('keeps the focus when another float is removed', () => {
    const closed = removeDesktopPane(withFloats(), 'p2');

    expect(closed.floats.map((float) => float.paneId)).toStrictEqual(['p3']);
    expect(closed.focusedPaneId).toBe('p3');
  });

  it('is unchanged for an unknown id', () => {
    const desktop = threePanes();

    expect(removeDesktopPane(desktop, 'nope')).toBe(desktop);
    expect(removeDesktopPane(EMPTY_DESKTOP, 'p1')).toBe(EMPTY_DESKTOP);
  });
});

describe(insertDesktopPane, () => {
  it('adds a tree pane beside the focused one and focuses it', () => {
    const inserted = insertDesktopPane(threePanes(), { paneId: 'p9', windowId: 'w9', rect: null });

    expect(treeShape(inserted)).toBe('row(p1:w1 col(p2:w2 row(p3:w3 p9:w9)))');
    expect(inserted.focusedPaneId).toBe('p9');
  });

  it('adds a float with its rectangle and focuses it', () => {
    const inserted = insertDesktopPane(threePanes(), { paneId: 'p9', windowId: 'w9', rect: RECT });

    expect(inserted.floats[0]?.rect).toStrictEqual(RECT);
    expect(inserted.focusedPaneId).toBe('p9');
  });
});
