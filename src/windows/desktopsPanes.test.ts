/**
 * The desktops model, pane level: focus, split, close, the float and dock
 * round trip and moving panes between desktops.
 */
import { describe, expect, it } from 'vitest';

import { treeOf, twoPanes } from './desktopFixtures';
import { EMPTY_DESKTOP } from './desktopPanes';
import {
  activeDesktop,
  closeFocusedPane,
  dockFocused,
  floatFocused,
  focusPane,
  focusedWindowId,
  goToDesktop,
  initialDesktops,
  movePaneToDesktop,
  newDesktop,
  splitFocused,
} from './desktops';

describe(focusPane, () => {
  it('focuses a pane of the active desktop', () => {
    expect(activeDesktop(focusPane(twoPanes(), 'p1')).focusedPaneId).toBe('p1');
  });

  it('raises a float', () => {
    const first = floatFocused(splitFocused(twoPanes(), 'row', 'w3'));
    const both = floatFocused(focusPane(first, 'p2'));
    const raised = focusPane(both, 'p3');

    expect(activeDesktop(both).floats.map((float) => float.paneId)).toStrictEqual(['p3', 'p2']);
    expect(activeDesktop(raised).floats.map((float) => float.paneId)).toStrictEqual(['p2', 'p3']);
    expect(activeDesktop(raised).focusedPaneId).toBe('p3');
  });

  it('is unchanged for a pane on another desktop', () => {
    const state = goToDesktop(twoPanes(), 2);

    expect(focusPane(state, 'p1')).toBe(state);
  });
});

describe(splitFocused, () => {
  it('splits the focused pane, gives it the next id and focuses it', () => {
    const state = splitFocused(twoPanes(), 'column', 'w3');

    expect(treeOf(state, 1)).toBe('row(p1:w1 col(p2:w2 p3:w3))');
    expect(activeDesktop(state).focusedPaneId).toBe('p3');
    expect(state.nextPaneSeq).toBe(4);
  });

  it('makes the first pane of an empty desktop', () => {
    const state = splitFocused(newDesktop(initialDesktops('w1')), 'row', 'w2');

    expect(treeOf(state, 2)).toBe('p2:w2');
    expect(treeOf(state, 1)).toBe('p1:w1');
  });
});

describe(closeFocusedPane, () => {
  it('focuses the sibling that took its place', () => {
    const state = closeFocusedPane(twoPanes());

    expect(treeOf(state, 1)).toBe('p1:w1');
    expect(activeDesktop(state).focusedPaneId).toBe('p1');
  });

  it('leaves the desktop empty when its last pane closes', () => {
    const empty = closeFocusedPane(initialDesktops('w1'));

    expect(activeDesktop(empty)).toStrictEqual(EMPTY_DESKTOP);
    expect(closeFocusedPane(empty)).toBe(empty);
    expect(empty.desktops).toHaveLength(1);
  });

  it('focuses the topmost float when the last tree pane closes', () => {
    const floating = floatFocused(twoPanes());
    const state = closeFocusedPane(focusPane(floating, 'p1'));

    expect(treeOf(state, 1)).toBeNull();
    expect(activeDesktop(state).focusedPaneId).toBe('p2');
  });

  it('closes a focused float', () => {
    const state = closeFocusedPane(floatFocused(twoPanes()));

    expect(activeDesktop(state).floats).toHaveLength(0);
    expect(activeDesktop(state).focusedPaneId).toBe('p1');
  });
});

describe('floatFocused and dockFocused', () => {
  it('tears the focused pane off into a float with the same id', () => {
    const state = floatFocused(twoPanes());

    expect(treeOf(state, 1)).toBe('p1:w1');
    expect(activeDesktop(state).floats[0]?.paneId).toBe('p2');
    expect(focusedWindowId(state)).toBe('w2');
  });

  it('round-trips a float back into the tree as a row split', () => {
    const state = dockFocused(floatFocused(twoPanes()));

    expect(treeOf(state, 1)).toBe('row(p1:w1 p2:w2)');
    expect(activeDesktop(state).floats).toHaveLength(0);
    expect(activeDesktop(state).focusedPaneId).toBe('p2');
  });

  it('docks the only float of a treeless desktop as the only pane', () => {
    const state = dockFocused(floatFocused(initialDesktops('w1')));

    expect(treeOf(state, 1)).toBe('p1:w1');
  });

  it('does nothing when there is nothing to float or dock', () => {
    const state = twoPanes();
    const empty = newDesktop(state);

    expect(dockFocused(state)).toBe(state);
    expect(floatFocused(empty)).toBe(empty);
  });
});

describe(movePaneToDesktop, () => {
  it('moves a tree pane to another desktop and keeps the view and its id', () => {
    const state = movePaneToDesktop(twoPanes(), 'p2', 2);

    expect(state.active).toBe(0);
    expect(treeOf(state, 1)).toBe('p1:w1');
    expect(activeDesktop(state).focusedPaneId).toBe('p1');
    expect(treeOf(state, 2)).toBe('p2:w2');
    expect(state.desktops[1]?.focusedPaneId).toBe('p2');
  });

  it('moves a float and keeps it floating', () => {
    const state = movePaneToDesktop(floatFocused(twoPanes()), 'p2', 2);

    expect(activeDesktop(state).floats).toHaveLength(0);
    expect(state.desktops[1]?.floats[0]?.paneId).toBe('p2');
  });

  it('creates missing desktops up to the target', () => {
    expect(movePaneToDesktop(twoPanes(), 'p1', 3).desktops).toHaveLength(3);
  });

  it('moves a pane from a desktop that is not shown', () => {
    const state = movePaneToDesktop(goToDesktop(twoPanes(), 2), 'p1', 2);

    expect(treeOf(state, 1)).toBe('p2:w2');
    expect(treeOf(state, 2)).toBe('p1:w1');
  });

  it('is unchanged for unknown panes, bad numbers and the same desktop', () => {
    const state = twoPanes();

    expect(movePaneToDesktop(state, 'nope', 2)).toBe(state);
    expect(movePaneToDesktop(state, 'p1', 0)).toBe(state);
    expect(movePaneToDesktop(state, 'p1', 1)).toBe(state);
  });
});
