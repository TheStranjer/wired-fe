/**
 * The desktops model, desktop level: the initial state, numbering, stepping
 * with wrap-around and creation past the end, and closing.
 */
import { describe, expect, it } from 'vitest';

import { three, treeOf, twoPanes } from './desktopFixtures';
import { EMPTY_DESKTOP } from './desktopPanes';
import {
  activeDesktop,
  closeDesktop,
  floatFocused,
  focusedWindowId,
  goToDesktop,
  initialDesktops,
  newDesktop,
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

  it('creates empty desktops up to a missing one', () => {
    const state = goToDesktop(initialDesktops('w1'), 4);

    expect(state.desktops).toHaveLength(4);
    expect(state.active).toBe(3);
    expect(state.desktops[2]).toStrictEqual(EMPTY_DESKTOP);
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

  it('creates a new empty desktop when going right past the last', () => {
    const state = stepDesktop(goToDesktop(three(), 3), 1);

    expect(state.desktops).toHaveLength(4);
    expect(state.active).toBe(3);
    expect(state.desktops[3]).toStrictEqual(EMPTY_DESKTOP);
  });
});

describe(newDesktop, () => {
  it('appends an empty desktop and shows it', () => {
    const state = newDesktop(three());

    expect(state.desktops).toHaveLength(4);
    expect(state.active).toBe(3);
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
