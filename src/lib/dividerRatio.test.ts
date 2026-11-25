/** Tests for the divider arithmetic: pointer to ratio, and keys to ratio. */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RATIO,
  clampRatio,
  keyedRatio,
  ownsDividerKey,
  ratioFromPointer,
} from './dividerRatio';

const BOUNDS = { min: 0.1, max: 0.9 };
const PLAIN = { ctrlKey: false, altKey: false, metaKey: false };

describe(ratioFromPointer, () => {
  const span = { start: 100, size: 400 };

  it('is the pointer offset over the size', () => {
    expect(ratioFromPointer(300, span, BOUNDS)).toBe(0.5);
    expect(ratioFromPointer(200, span, BOUNDS)).toBe(0.25);
  });

  it('clamps beyond either edge', () => {
    expect(ratioFromPointer(0, span, BOUNDS)).toBe(0.1);
    expect(ratioFromPointer(900, span, BOUNDS)).toBe(0.9);
  });

  it('falls back to the default for a container with no extent', () => {
    expect(ratioFromPointer(10, { start: 0, size: 0 }, BOUNDS)).toBe(DEFAULT_RATIO);
  });
});

describe(clampRatio, () => {
  it('keeps a ratio within the bounds', () => {
    expect(clampRatio(0.5, BOUNDS)).toBe(0.5);
    expect(clampRatio(0, BOUNDS)).toBe(0.1);
    expect(clampRatio(1, BOUNDS)).toBe(0.9);
  });
});

describe(keyedRatio, () => {
  it('steps by 5% with the arrows', () => {
    expect(keyedRatio('ArrowRight', 0.5, BOUNDS)).toBe(0.55);
    expect(keyedRatio('ArrowDown', 0.5, BOUNDS)).toBe(0.55);
    expect(keyedRatio('ArrowLeft', 0.5, BOUNDS)).toBe(0.45);
    expect(keyedRatio('ArrowUp', 0.55, BOUNDS)).toBe(0.5);
  });

  it('does not drift over repeated steps', () => {
    expect(keyedRatio('ArrowRight', keyedRatio('ArrowRight', 0.5, BOUNDS), BOUNDS)).toBe(0.6);
  });

  it('stops at the bounds', () => {
    expect(keyedRatio('ArrowRight', 0.9, BOUNDS)).toBe(0.9);
    expect(keyedRatio('ArrowLeft', 0.1, BOUNDS)).toBe(0.1);
  });

  it('jumps to the bounds with Home and End', () => {
    expect(keyedRatio('Home', 0.5, BOUNDS)).toBe(0.1);
    expect(keyedRatio('End', 0.5, BOUNDS)).toBe(0.9);
  });

  it('leaves the ratio alone for any other key', () => {
    expect(keyedRatio('a', 0.5, BOUNDS)).toBe(0.5);
  });
});

describe(ownsDividerKey, () => {
  it('owns arrows, Home and End', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      expect(ownsDividerKey({ key, ...PLAIN })).toBe(true);
    }
  });

  it('leaves other keys to the hotkeys', () => {
    expect(ownsDividerKey({ key: 'b', ...PLAIN })).toBe(false);
  });

  it('leaves modified keys to the hotkeys', () => {
    expect(ownsDividerKey({ key: 'ArrowLeft', ...PLAIN, ctrlKey: true })).toBe(false);
    expect(ownsDividerKey({ key: 'ArrowLeft', ...PLAIN, altKey: true })).toBe(false);
    expect(ownsDividerKey({ key: 'ArrowLeft', ...PLAIN, metaKey: true })).toBe(false);
  });
});
