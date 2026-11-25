/**
 * The floats model: clamping on every edge, cascading, move and resize,
 * z-order, removal and identity for unknown ids.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FLOAT_RECT,
  MIN_FLOAT_SIZE,
  addFloat,
  clampRect,
  findFloat,
  moveFloat,
  raiseFloat,
  removeFloat,
  resizeFloat,
  setFloatWindow,
} from './floats';
import type { FloatRect, Floats } from './floats';

const RECT: FloatRect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
const PRECISION = 1e6;

function two(): Floats {
  return addFloat(addFloat([], 'p1', 'w1', RECT), 'p2', 'w2', RECT);
}

/** The rectangle with float noise rounded away, for exact comparison. */
function round(rect: FloatRect | undefined): FloatRect | undefined {
  if (rect === undefined) {
    return undefined;
  }
  const r = (n: number): number => Math.round(n * PRECISION) / PRECISION;
  return { x: r(rect.x), y: r(rect.y), w: r(rect.w), h: r(rect.h) };
}

function ids(floats: Floats): readonly string[] {
  return floats.map((float) => float.paneId);
}

describe(clampRect, () => {
  it('keeps a rectangle that fits', () => {
    expect(clampRect(RECT)).toStrictEqual(RECT);
  });

  it('pulls a rectangle back from every edge', () => {
    expect(round(clampRect({ ...RECT, x: -0.3 }))).toStrictEqual({ ...RECT, x: 0 });
    expect(round(clampRect({ ...RECT, x: 0.9 }))).toStrictEqual({ ...RECT, x: 0.6 });
    expect(round(clampRect({ ...RECT, y: -0.3 }))).toStrictEqual({ ...RECT, y: 0 });
    expect(round(clampRect({ ...RECT, y: 0.9 }))).toStrictEqual({ ...RECT, y: 0.6 });
  });

  it('limits an oversize rectangle to the viewport', () => {
    expect(clampRect({ x: 0.5, y: 0.5, w: 3, h: 2 })).toStrictEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('raises a tiny rectangle to the minimum size', () => {
    expect(clampRect({ x: 0.5, y: 0.5, w: 0, h: -1 })).toStrictEqual({
      x: 0.5,
      y: 0.5,
      w: MIN_FLOAT_SIZE,
      h: MIN_FLOAT_SIZE,
    });
  });
});

describe(addFloat, () => {
  it('adds on top with the default rectangle', () => {
    expect(addFloat([], 'p1', 'w1')).toStrictEqual([
      { paneId: 'p1', windowId: 'w1', rect: DEFAULT_FLOAT_RECT },
    ]);
  });

  it('cascades by 0.03 per existing float', () => {
    const floats = addFloat(addFloat(addFloat([], 'p1', 'w1'), 'p2', 'w2'), 'p3', 'w3');

    expect(round(floats[1]?.rect)).toStrictEqual({ ...DEFAULT_FLOAT_RECT, x: 0.28, y: 0.23 });
    expect(round(floats[2]?.rect)).toStrictEqual({ ...DEFAULT_FLOAT_RECT, x: 0.31, y: 0.26 });
    expect(ids(floats)).toStrictEqual(['p1', 'p2', 'p3']);
  });

  it('clamps a cascade that runs off the viewport', () => {
    let floats: Floats = [];
    for (let i = 0; i < 30; i += 1) {
      floats = addFloat(floats, `p${String(i)}`, 'w');
    }

    expect(round(floats[29]?.rect)).toStrictEqual({ x: 0.5, y: 0.4, w: 0.5, h: 0.6 });
  });

  it('uses an explicit rectangle', () => {
    expect(addFloat(two(), 'p3', 'w3', RECT)[2]?.rect).toStrictEqual(RECT);
  });

  it('clamps an explicit rectangle', () => {
    expect(addFloat([], 'p3', 'w3', { x: 2, y: -2, w: 0.5, h: 0.5 })[0]?.rect).toStrictEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 0.5,
    });
  });
});

describe(moveFloat, () => {
  it('moves by the delta', () => {
    expect(round(findFloat(moveFloat(two(), 'p1', 0.1, -0.1), 'p1')?.rect)).toStrictEqual({
      ...RECT,
      x: 0.3,
      y: 0.1,
    });
  });

  it('clamps at every edge', () => {
    expect(round(findFloat(moveFloat(two(), 'p1', -1, -1), 'p1')?.rect)).toStrictEqual({
      ...RECT,
      x: 0,
      y: 0,
    });
    expect(round(findFloat(moveFloat(two(), 'p1', 1, 1), 'p1')?.rect)).toStrictEqual({
      ...RECT,
      x: 0.6,
      y: 0.6,
    });
  });

  it('leaves other floats alone', () => {
    const floats = two();

    expect(moveFloat(floats, 'p1', 0.1, 0)[1]).toBe(floats[1]);
  });

  it('keeps identity for an unknown id', () => {
    const floats = two();

    expect(moveFloat(floats, 'nope', 0.1, 0.1)).toBe(floats);
  });
});

describe(resizeFloat, () => {
  it('resizes from the bottom-right corner', () => {
    expect(round(findFloat(resizeFloat(two(), 'p1', 0.2, -0.1), 'p1')?.rect)).toStrictEqual({
      ...RECT,
      w: 0.6,
      h: 0.3,
    });
  });

  it('clamps to the minimum size', () => {
    expect(round(findFloat(resizeFloat(two(), 'p1', -1, -1), 'p1')?.rect)).toStrictEqual({
      ...RECT,
      w: MIN_FLOAT_SIZE,
      h: MIN_FLOAT_SIZE,
    });
  });

  it('clamps to the viewport', () => {
    expect(round(findFloat(resizeFloat(two(), 'p1', 5, 5), 'p1')?.rect)).toStrictEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it('keeps identity for an unknown id', () => {
    const floats = two();

    expect(resizeFloat(floats, 'nope', 0.1, 0.1)).toBe(floats);
  });
});

describe(raiseFloat, () => {
  it('moves the float to the end', () => {
    const floats = addFloat(two(), 'p3', 'w3', RECT);

    expect(ids(raiseFloat(floats, 'p1'))).toStrictEqual(['p2', 'p3', 'p1']);
    expect(ids(raiseFloat(floats, 'p3'))).toStrictEqual(['p1', 'p2', 'p3']);
  });

  it('keeps identity for an unknown id', () => {
    const floats = two();

    expect(raiseFloat(floats, 'nope')).toBe(floats);
  });
});

describe(removeFloat, () => {
  it('removes the float', () => {
    expect(ids(removeFloat(two(), 'p1'))).toStrictEqual(['p2']);
  });

  it('keeps identity for an unknown id', () => {
    const floats = two();

    expect(removeFloat(floats, 'nope')).toBe(floats);
  });
});

describe(findFloat, () => {
  it('finds a float or returns null', () => {
    expect(findFloat(two(), 'p2')?.windowId).toBe('w2');
    expect(findFloat(two(), 'nope')).toBeNull();
  });
});

describe(setFloatWindow, () => {
  it('shows another window in the float', () => {
    const floats = setFloatWindow(two(), 'p1', 'w9');

    expect(floats[0]).toStrictEqual({ paneId: 'p1', windowId: 'w9', rect: RECT });
    expect(floats[1]?.windowId).toBe('w2');
  });

  it('keeps identity for an unknown id', () => {
    const floats = two();

    expect(setFloatWindow(floats, 'nope', 'w9')).toBe(floats);
  });
});
