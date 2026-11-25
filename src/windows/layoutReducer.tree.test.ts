/**
 * The layout reducer's float and split-tree actions: each reaches its pure
 * function (spot-checked, not re-tested), and an action that changes nothing
 * hands back the very same state.
 */
import { describe, expect, it } from 'vitest';

import { treeOf, twoPanes, withFloats } from './desktopFixtures';
import type { DesktopsState } from './desktops';
import { activeDesktop, initialDesktops, newDesktop } from './desktops';
import { layoutReducer } from './layoutReducer';

/** One desktop with `p1:w1` in the tree and floats p2 (below) and p3 (on top). */
function floating(): DesktopsState {
  return { desktops: [withFloats()], active: 0, nextPaneSeq: 4 };
}

/** The float ids of the active desktop, bottom to top. */
function floatIds(state: DesktopsState): readonly string[] {
  return activeDesktop(state).floats.map((float) => float.paneId);
}

/** The ratio of the root split of the active desktop, or null for a lone pane. */
function rootRatio(state: DesktopsState): number | null {
  const { tree } = activeDesktop(state);
  return tree?.type === 'split' ? tree.ratio : null;
}

/** `twoPanes()` with nothing focused. */
function unfocused(): DesktopsState {
  const state = twoPanes();
  return { ...state, desktops: [{ ...activeDesktop(state), focusedPaneId: null }] };
}

describe(layoutReducer, () => {
  describe('float actions', () => {
    it('moveFloat moves a float', () => {
      const state = layoutReducer(floating(), { type: 'moveFloat', paneId: 'p2', dx: 0.1, dy: 0 });

      expect(activeDesktop(state).floats[0]?.rect.x).toBeCloseTo(0.2);
    });

    it('moveFloat keeps the state when the float does not move', () => {
      const state = floating();

      expect(layoutReducer(state, { type: 'moveFloat', paneId: 'p2', dx: 0, dy: 0 })).toBe(state);
      expect(layoutReducer(state, { type: 'moveFloat', paneId: 'p9', dx: 0.1, dy: 0 })).toBe(state);
    });

    it('resizeFloat resizes a float from its corner', () => {
      const state = layoutReducer(floating(), {
        type: 'resizeFloat',
        paneId: 'p2',
        dw: 0.1,
        dh: 0.2,
      });

      expect(activeDesktop(state).floats[0]?.rect.w).toBeCloseTo(0.4);
      expect(activeDesktop(state).floats[0]?.rect.h).toBeCloseTo(0.5);
    });

    it('raiseFloat puts a float on top', () => {
      const state = layoutReducer(floating(), { type: 'raiseFloat', paneId: 'p2' });

      expect(floatIds(state)).toStrictEqual(['p3', 'p2']);
    });

    it('raiseFloat keeps the state when the float is already on top', () => {
      const state = floating();

      expect(layoutReducer(state, { type: 'raiseFloat', paneId: 'p3' })).toBe(state);
    });
  });

  describe('tree actions', () => {
    it('setRatio sets the ratio of a split', () => {
      const state = layoutReducer(twoPanes(), { type: 'setRatio', path: [], ratio: 0.7 });

      expect(rootRatio(state)).toBeCloseTo(0.7);
    });

    it('setRatio keeps the state for a path that is no split', () => {
      const state = twoPanes();

      expect(layoutReducer(state, { type: 'setRatio', path: ['a'], ratio: 0.7 })).toBe(state);
    });

    it('resizePane grows the focused pane along a direction', () => {
      const state = layoutReducer(twoPanes(), { type: 'resizePane', dir: 'row', delta: 0.1 });

      expect(rootRatio(state)).toBeCloseTo(0.4);
    });

    it('resizePane keeps the state when no pane has focus', () => {
      const state = unfocused();

      expect(layoutReducer(state, { type: 'resizePane', dir: 'row', delta: 0.1 })).toBe(state);
    });

    it('equalize evens out the ratios', () => {
      const skewed = layoutReducer(twoPanes(), { type: 'setRatio', path: [], ratio: 0.8 });

      expect(rootRatio(layoutReducer(skewed, { type: 'equalize' }))).toBeCloseTo(0.5);
    });

    it('equalize keeps the state when the ratios are even', () => {
      const state = twoPanes();

      expect(layoutReducer(state, { type: 'equalize' })).toBe(state);
    });

    it('swap exchanges the focused pane with its neighbour', () => {
      const state = layoutReducer(twoPanes(), { type: 'swap', direction: 'left' });

      expect(treeOf(state, 1)).toBe('row(p1:w2 p2:w1)');
      expect(activeDesktop(state).focusedPaneId).toBe('p1');
    });

    it('swap keeps the state at the edge, with a float or with no focus', () => {
      const edge = twoPanes();
      const state = floating();
      const none = unfocused();

      expect(layoutReducer(edge, { type: 'swap', direction: 'right' })).toBe(edge);
      expect(layoutReducer(state, { type: 'swap', direction: 'left' })).toBe(state);
      expect(layoutReducer(none, { type: 'swap', direction: 'left' })).toBe(none);
    });

    it('only reduces the tree to the focused pane', () => {
      const state = layoutReducer(twoPanes(), { type: 'only' });

      expect(treeOf(state, 1)).toBe('p2:w2');
    });

    it('only keeps the state when no pane has focus', () => {
      const state = unfocused();

      expect(layoutReducer(state, { type: 'only' })).toBe(state);
    });

    it('keeps the state on an empty desktop', () => {
      const empty = newDesktop(initialDesktops('w1'));

      expect(layoutReducer(empty, { type: 'equalize' })).toBe(empty);
    });
  });
});
