/**
 * Tests for moving focus (decision 12): every direction on a 2×2 grid, the
 * quiet no-op at an edge, focus from a float, and next and prev wrapping over
 * tree panes then floats.
 */
import { describe, expect, it } from 'vitest';

import { activeDesktop, initialDesktops, updateActive } from './desktops';
import type { DesktopsState } from './desktops';
import type { FloatRect } from './floats';
import { moveFocus } from './paneFocus';
import type { FocusStep } from './paneFocus';
import { MIDDLE, focusOn, grid, withFloat } from './paneFocusFixtures';

/** The pane focused after {@link step} from {@link state}. */
function focusedAfter(state: DesktopsState, step: FocusStep): string | null {
  return activeDesktop(moveFocus(state, step)).focusedPaneId;
}

/** A float whose centre is (0.7, 0.2): above the right column. */
const HIGH_RIGHT: FloatRect = { x: 0.6, y: 0.1, w: 0.2, h: 0.2 };

describe(moveFocus, () => {
  it.each([
    ['p1', 'right', 'p2'],
    ['p1', 'down', 'p4'],
    ['p2', 'left', 'p1'],
    ['p2', 'down', 'p3'],
    ['p3', 'left', 'p4'],
    ['p3', 'up', 'p2'],
    ['p4', 'right', 'p3'],
    ['p4', 'up', 'p1'],
  ] as const)('from %s %s focuses %s', (from, step, to) => {
    expect(focusedAfter(focusOn(grid(), from), step)).toBe(to);
  });

  it.each([
    ['p1', 'left'],
    ['p1', 'up'],
    ['p2', 'right'],
    ['p2', 'up'],
    ['p3', 'right'],
    ['p3', 'down'],
    ['p4', 'left'],
    ['p4', 'down'],
  ] as const)('at the edge, from %s %s changes nothing', (from, step) => {
    const state = focusOn(grid(), from);

    expect(moveFocus(state, step)).toBe(state);
  });

  it('changes nothing on an empty desktop or with no focus', () => {
    const empty = updateActive(grid(), () => ({ tree: null, floats: [], focusedPaneId: null }));
    const none = focusOn(grid(), null);

    expect(moveFocus(empty, 'left')).toBe(empty);
    expect(moveFocus(empty, 'next')).toBe(empty);
    expect(moveFocus(none, 'left')).toBe(none);
  });

  it('changes nothing when the focus names no pane', () => {
    const lost = focusOn(grid(), 'p99');

    expect(moveFocus(lost, 'left')).toBe(lost);
  });
});

describe('moveFocus from a float', () => {
  it('goes to the tree pane nearest its centre in that direction', () => {
    const state = withFloat(grid(), 'p9', HIGH_RIGHT);

    expect(focusedAfter(state, 'left')).toBe('p1');
    expect(focusedAfter(state, 'right')).toBe('p2');
    expect(focusedAfter(state, 'down')).toBe('p2');
  });

  it('stays when no pane lies that way', () => {
    const state = withFloat(grid(), 'p9', HIGH_RIGHT);

    expect(moveFocus(state, 'up')).toBe(state);
  });

  it('takes the first pane in tree order on a tie', () => {
    const state = withFloat(grid(), 'p9', MIDDLE);

    expect(focusedAfter(state, 'left')).toBe('p1');
    expect(focusedAfter(state, 'right')).toBe('p2');
    expect(focusedAfter(state, 'up')).toBe('p1');
    expect(focusedAfter(state, 'down')).toBe('p4');
  });

  it('stays when the desktop has no tree', () => {
    const floating = updateActive(withFloat(grid(), 'p9', MIDDLE), (desktop) => ({
      ...desktop,
      tree: null,
    }));

    expect(moveFocus(floating, 'left')).toBe(floating);
  });
});

/** The grid with floats p5 (below) and p6 (on top), focus on p3. */
function stacked(): DesktopsState {
  const one = withFloat(grid(), 'p5', MIDDLE);
  return focusOn(withFloat(one, 'p6', HIGH_RIGHT), 'p3');
}

describe('moveFocus next and prev', () => {
  it('visits the tree panes in order, then the floats in z-order', () => {
    const first = focusOn(stacked(), 'p1');
    const visited = [1, 2, 3, 4, 5].reduce<DesktopsState[]>(
      (seen) => [...seen, moveFocus(seen.at(-1) ?? first, 'next')],
      [first],
    );

    expect(visited.map((state) => activeDesktop(state).focusedPaneId)).toStrictEqual([
      'p1',
      'p4',
      'p2',
      'p3',
      'p5',
      'p6',
    ]);
  });

  it('wraps next from the top float to the first pane', () => {
    expect(focusedAfter(focusOn(stacked(), 'p6'), 'next')).toBe('p1');
  });

  it('wraps prev from the first pane to the top float', () => {
    expect(focusedAfter(focusOn(stacked(), 'p1'), 'prev')).toBe('p6');
  });

  it('goes back from a float to the tree pane before it', () => {
    expect(focusedAfter(focusOn(stacked(), 'p5'), 'prev')).toBe('p3');
  });

  it('focuses a float without raising it, so every float is reachable', () => {
    const next = moveFocus(stacked(), 'next');

    expect(activeDesktop(next).floats.map((float) => float.paneId)).toStrictEqual(['p5', 'p6']);
    expect(activeDesktop(next).focusedPaneId).toBe('p5');
  });

  it('starts at the first pane going next and the last going prev with no focus', () => {
    const none = focusOn(stacked(), null);

    expect(focusedAfter(none, 'next')).toBe('p1');
    expect(focusedAfter(none, 'prev')).toBe('p6');
  });

  it('changes nothing with a single pane', () => {
    const state = initialDesktops('w1');

    expect(moveFocus(state, 'next')).toBe(state);
    expect(moveFocus(state, 'prev')).toBe(state);
  });
});
