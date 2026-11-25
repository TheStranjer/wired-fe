/**
 * Pane-level lookups on one desktop: finding, focusing and splitting.
 */
import { describe, expect, it } from 'vitest';

import { RECT, threePanes, treeShape, withFloats } from './desktopFixtures';
import {
  EMPTY_DESKTOP,
  findPlaced,
  focusDesktopPane,
  focusedWindow,
  splitDesktop,
} from './desktopPanes';

describe(findPlaced, () => {
  it('finds a tree pane with no rectangle', () => {
    expect(findPlaced(threePanes(), 'p2')).toStrictEqual({
      paneId: 'p2',
      windowId: 'w2',
      rect: null,
    });
  });

  it('finds a float with its rectangle', () => {
    expect(findPlaced(withFloats(), 'p2')?.rect).toStrictEqual(RECT);
  });

  it('is null for an unknown id and on an empty desktop', () => {
    expect(findPlaced(threePanes(), 'nope')).toBeNull();
    expect(findPlaced(EMPTY_DESKTOP, 'p1')).toBeNull();
  });
});

describe(focusedWindow, () => {
  it('is the window of the focused tree pane or float', () => {
    expect(focusedWindow(threePanes())).toBe('w3');
    expect(focusedWindow(withFloats())).toBe('w3');
  });

  it('is null with no focus or a stale focus', () => {
    expect(focusedWindow(EMPTY_DESKTOP)).toBeNull();
    expect(focusedWindow({ ...threePanes(), focusedPaneId: 'gone' })).toBeNull();
  });
});

describe(focusDesktopPane, () => {
  it('focuses a tree pane', () => {
    expect(focusDesktopPane(threePanes(), 'p1').focusedPaneId).toBe('p1');
  });

  it('keeps the same desktop when the pane already has focus', () => {
    const desktop = threePanes();

    expect(focusDesktopPane(desktop, 'p3')).toBe(desktop);
  });

  it('focuses a float and raises it', () => {
    const focused = focusDesktopPane(withFloats(), 'p2');

    expect(focused.focusedPaneId).toBe('p2');
    expect(focused.floats.map((float) => float.paneId)).toStrictEqual(['p3', 'p2']);
  });

  it('ignores unknown ids and empty desktops', () => {
    const desktop = threePanes();

    expect(focusDesktopPane(desktop, 'nope')).toBe(desktop);
    expect(focusDesktopPane(EMPTY_DESKTOP, 'p1')).toBe(EMPTY_DESKTOP);
  });
});

describe(splitDesktop, () => {
  it('makes the first pane of an empty desktop and focuses it', () => {
    const desktop = splitDesktop(EMPTY_DESKTOP, 'row', 'p1', 'w1');

    expect(treeShape(desktop)).toBe('p1:w1');
    expect(desktop.focusedPaneId).toBe('p1');
  });

  it('splits the focused pane and focuses the new one', () => {
    const desktop = threePanes();

    expect(treeShape(desktop)).toBe('row(p1:w1 col(p2:w2 p3:w3))');
    expect(desktop.focusedPaneId).toBe('p3');
  });

  it('splits the last pane when a float, nothing or a stale id has focus', () => {
    const base = threePanes();
    const lastSplit = 'row(p1:w1 col(p2:w2 row(p3:w3 p4:w4)))';

    expect(treeShape(splitDesktop(withFloats(), 'row', 'p4', 'w4'))).toBe('row(p1:w1 p4:w4)');
    expect(treeShape(splitDesktop({ ...base, focusedPaneId: null }, 'row', 'p4', 'w4'))).toBe(
      lastSplit,
    );
    expect(treeShape(splitDesktop({ ...base, focusedPaneId: 'gone' }, 'row', 'p4', 'w4'))).toBe(
      lastSplit,
    );
  });

  it('is unchanged when the pane id is already in the tree', () => {
    const desktop = threePanes();

    expect(splitDesktop(desktop, 'row', 'p1', 'w9')).toBe(desktop);
  });
});
