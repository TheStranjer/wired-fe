/**
 * The desktops model, desktop level: the initial state, numbering, stepping
 * with wrap-around and creation past the end, and closing.
 */
import { describe, expect, it } from 'vitest';

import { three, treeOf, twoPanes, withFloats } from './desktopFixtures';
import { EMPTY_DESKTOP } from './desktopPanes';
import {
  activeDesktop,
  closeDesktop,
  floatFocused,
  focusedWindowId,
  goToDesktop,
  initialDesktops,
  newDesktop,
  pruneDesktops,
  stepDesktop,
} from './desktops';

describe(initialDesktops, () => {
  it('is one desktop with one focused pane showing the window', () => {
    const state = initialDesktops('w1');

    expect(state.desktops).toHaveLength(1);
    expect(state.active).toBe(0);
    expect(treeOf(state, 1)).toBe('p1:w1');
    expect(activeDesktop(state).focusedPaneId).toBe('p1');
    expect(state.nextPaneSeq).toBe(2);
  });
});

describe(activeDesktop, () => {
  it('is the desktop at the active index', () => {
    const state = three();

    expect(activeDesktop(state)).toBe(state.desktops[1]);
  });

  it('is an empty desktop when the index is out of range', () => {
    expect(activeDesktop({ ...initialDesktops('w1'), active: 5 })).toBe(EMPTY_DESKTOP);
  });
});

describe(focusedWindowId, () => {
  it('is the window of the focused pane', () => {
    expect(focusedWindowId(twoPanes())).toBe('w2');
  });

  it('is the window of a focused float', () => {
    expect(focusedWindowId(floatFocused(twoPanes()))).toBe('w2');
  });

  it('is null on an empty desktop', () => {
    expect(focusedWindowId(newDesktop(twoPanes()))).toBeNull();
  });
});

describe(goToDesktop, () => {
  it('shows an existing desktop', () => {
    expect(goToDesktop(three(), 3).active).toBe(2);
  });

  it('makes the desktop just past the end when the last one is not empty', () => {
    const state = goToDesktop(initialDesktops('w1'), 2);

    expect(state.desktops).toHaveLength(2);
    expect(state.active).toBe(1);
    expect(state.desktops[1]).toStrictEqual(EMPTY_DESKTOP);
  });

  it('refuses the desktop just past an empty last one', () => {
    const state = three();

    expect(goToDesktop(state, 4)).toBe(state);
  });

  it('refuses a number further past the end, whatever the last desktop holds', () => {
    const full = initialDesktops('w1');
    const empty = three();

    expect(goToDesktop(full, 6)).toBe(full);
    expect(goToDesktop(empty, empty.desktops.length + 5)).toBe(empty);
  });

  it('moves between existing empty desktops', () => {
    const state = goToDesktop(three(), 3);

    expect(state.active).toBe(2);
    expect(goToDesktop(state, 2).active).toBe(1);
  });

  it('ignores numbers that are not 1 or more', () => {
    const state = initialDesktops('w1');

    expect(goToDesktop(state, 0)).toBe(state);
    expect(goToDesktop(state, -2)).toBe(state);
    expect(goToDesktop(state, 1.5)).toBe(state);
  });
});

describe(stepDesktop, () => {
  it('steps right and left between existing desktops', () => {
    expect(stepDesktop(three(), 1).active).toBe(2);
    expect(stepDesktop(three(), -1).active).toBe(0);
  });

  it('wraps from the first desktop to the last when going left', () => {
    expect(stepDesktop(goToDesktop(three(), 1), -1).active).toBe(2);
  });

  it('stays put when going left on the only desktop', () => {
    expect(stepDesktop(initialDesktops('w1'), -1).active).toBe(0);
  });

  it('creates a new empty desktop when going right past a last desktop with something on it', () => {
    const state = stepDesktop(initialDesktops('w1'), 1);

    expect(state.desktops).toHaveLength(2);
    expect(state.active).toBe(1);
    expect(state.desktops[1]).toStrictEqual(EMPTY_DESKTOP);
  });

  it('makes a desktop past a last desktop that holds only a float', () => {
    const [first = EMPTY_DESKTOP] = twoPanes().desktops;
    const floating = { ...first, tree: null, floats: withFloats().floats };
    const state = { ...twoPanes(), desktops: [floating], active: 0 };

    expect(stepDesktop(state, 1).desktops).toHaveLength(2);
  });

  it('stays put going right past an empty last desktop', () => {
    const state = goToDesktop(three(), 3);

    expect(stepDesktop(state, 1)).toBe(state);
  });

  it('steps between existing empty desktops', () => {
    expect(stepDesktop(three(), 1).active).toBe(2);
    expect(stepDesktop(goToDesktop(three(), 3), -1).active).toBe(1);
  });
});

describe(newDesktop, () => {
  it('appends an empty desktop and shows it when the last one is not empty', () => {
    const state = newDesktop(twoPanes());

    expect(state.desktops).toHaveLength(2);
    expect(state.active).toBe(1);
  });

  it('is unchanged when the last desktop is empty', () => {
    const state = three();

    expect(newDesktop(state)).toBe(state);
  });
});

describe(pruneDesktops, () => {
  it('removes the empty desktops, keeps the active one and fixes up the active index', () => {
    const state = pruneDesktops({
      ...three(),
      desktops: [EMPTY_DESKTOP, ...three().desktops.slice(0, 1), EMPTY_DESKTOP, EMPTY_DESKTOP],
      active: 3,
    });

    expect(state.desktops).toHaveLength(2);
    expect(treeOf(state, 1)).toBe('row(p1:w1 p2:w2)');
    expect(state.desktops[1]).toStrictEqual(EMPTY_DESKTOP);
    expect(state.active).toBe(1);
  });

  it('keeps an empty-tree desktop that holds a float', () => {
    const floating = { ...EMPTY_DESKTOP, floats: withFloats().floats };
    const state = pruneDesktops({
      ...three(),
      desktops: [EMPTY_DESKTOP, floating, EMPTY_DESKTOP],
      active: 2,
    });

    expect(state.desktops).toStrictEqual([floating, EMPTY_DESKTOP]);
    expect(state.active).toBe(1);
  });

  it('leaves one desktop when everything but the active one is empty', () => {
    const state = pruneDesktops({
      ...three(),
      desktops: [EMPTY_DESKTOP, EMPTY_DESKTOP],
      active: 1,
    });

    expect(state.desktops).toStrictEqual([EMPTY_DESKTOP]);
    expect(state.active).toBe(0);
  });

  it('is the same state when no desktop but the active one is empty', () => {
    const first = twoPanes().desktops[0] ?? EMPTY_DESKTOP;
    const full = { ...twoPanes(), desktops: [first, first], active: 0 };

    expect(pruneDesktops(full)).toBe(full);
    expect(pruneDesktops(initialDesktops('w1'))).toStrictEqual(initialDesktops('w1'));
  });
});

describe(closeDesktop, () => {
  it('never closes the last remaining desktop', () => {
    const state = initialDesktops('w1');

    expect(closeDesktop(state, 1)).toBe(state);
  });

  it('ignores desktops that do not exist', () => {
    const state = three();

    expect(closeDesktop(state, 4)).toBe(state);
    expect(closeDesktop(state, 0)).toBe(state);
    expect(closeDesktop(state, 1.5)).toBe(state);
  });

  it('shifts the active index down when a desktop before it closes', () => {
    const state = closeDesktop(three(), 1);

    expect(state.desktops).toHaveLength(2);
    expect(state.active).toBe(0);
  });

  it('keeps the active index when a desktop after it closes', () => {
    const state = closeDesktop(three(), 3);

    expect(state.desktops).toHaveLength(2);
    expect(state.active).toBe(1);
  });

  it('shows the next desktop when the active one closes, or the previous at the end', () => {
    expect(closeDesktop(three(), 2).active).toBe(1);
    expect(closeDesktop(goToDesktop(three(), 3), 3).active).toBe(1);
  });
});
