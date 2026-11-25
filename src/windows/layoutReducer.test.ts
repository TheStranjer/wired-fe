/**
 * The layout reducer's desktop and pane actions: each reaches its pure
 * function (spot-checked, not re-tested), and an action that changes nothing
 * hands back the very same state.
 */
import { describe, expect, it } from 'vitest';

import { three, treeOf, twoPanes } from './desktopFixtures';
import { activeDesktop, goToDesktop, initialDesktops } from './desktops';
import { layoutReducer } from './layoutReducer';

describe(layoutReducer, () => {
  describe('desktop actions', () => {
    it('goToDesktop shows a desktop, creating missing ones', () => {
      const state = layoutReducer(initialDesktops('w1'), { type: 'goToDesktop', n: 3 });

      expect(state.desktops).toHaveLength(3);
      expect(state.active).toBe(2);
    });

    it('goToDesktop keeps the state when the desktop is already shown', () => {
      const state = initialDesktops('w1');

      expect(layoutReducer(state, { type: 'goToDesktop', n: 1 })).toBe(state);
    });

    it('stepDesktop wraps left of the first desktop to the last', () => {
      const first = goToDesktop(three(), 1);

      expect(layoutReducer(first, { type: 'stepDesktop', step: -1 }).active).toBe(2);
    });

    it('stepDesktop keeps the state when there is nowhere to go', () => {
      const state = initialDesktops('w1');

      expect(layoutReducer(state, { type: 'stepDesktop', step: -1 })).toBe(state);
    });

    it('newDesktop appends an empty desktop and shows it', () => {
      const state = layoutReducer(initialDesktops('w1'), { type: 'newDesktop' });

      expect(state.desktops).toHaveLength(2);
      expect(state.active).toBe(1);
    });

    it('closeDesktop removes a desktop', () => {
      const state = layoutReducer(three(), { type: 'closeDesktop', n: 3 });

      expect(state.desktops).toHaveLength(2);
    });

    it('closeDesktop keeps the state for the last remaining desktop', () => {
      const state = initialDesktops('w1');

      expect(layoutReducer(state, { type: 'closeDesktop', n: 1 })).toBe(state);
    });

    it('movePaneToDesktop moves a pane to another desktop', () => {
      const state = layoutReducer(twoPanes(), { type: 'movePaneToDesktop', paneId: 'p1', n: 2 });

      expect(treeOf(state, 1)).toBe('p2:w2');
      expect(treeOf(state, 2)).toBe('p1:w1');
    });

    it('movePaneToDesktop keeps the state for an unknown pane', () => {
      const state = twoPanes();

      expect(layoutReducer(state, { type: 'movePaneToDesktop', paneId: 'p9', n: 2 })).toBe(state);
    });
  });

  describe('pane actions', () => {
    it('focusPane focuses a pane', () => {
      const state = layoutReducer(twoPanes(), { type: 'focusPane', paneId: 'p1' });

      expect(activeDesktop(state).focusedPaneId).toBe('p1');
    });

    it('focusStep moves focus to the neighbouring pane', () => {
      const state = layoutReducer(twoPanes(), { type: 'focusStep', step: 'left' });

      expect(activeDesktop(state).focusedPaneId).toBe('p1');
    });

    it('focusStep keeps the state at the edge', () => {
      const state = twoPanes();

      expect(layoutReducer(state, { type: 'focusStep', step: 'right' })).toBe(state);
    });

    it('focusPane keeps the state for an unknown pane', () => {
      const state = twoPanes();

      expect(layoutReducer(state, { type: 'focusPane', paneId: 'p9' })).toBe(state);
    });

    it('split splits the focused pane and focuses the new one', () => {
      const state = layoutReducer(twoPanes(), { type: 'split', dir: 'column', windowId: 'w3' });

      expect(treeOf(state, 1)).toBe('row(p1:w1 col(p2:w2 p3:w3))');
      expect(activeDesktop(state).focusedPaneId).toBe('p3');
    });

    it('split keeps the state when the new pane id is already taken', () => {
      const taken = { ...initialDesktops('w1'), nextPaneSeq: 1 };

      expect(layoutReducer(taken, { type: 'split', dir: 'row', windowId: 'w2' })).toBe(taken);
    });

    it('closePane closes the focused pane and focuses its sibling', () => {
      const state = layoutReducer(twoPanes(), { type: 'closePane' });

      expect(treeOf(state, 1)).toBe('p1:w1');
      expect(activeDesktop(state).focusedPaneId).toBe('p1');
    });

    it('closePane keeps the state on an empty desktop', () => {
      const empty = layoutReducer(initialDesktops('w1'), { type: 'newDesktop' });

      expect(layoutReducer(empty, { type: 'closePane' })).toBe(empty);
    });

    it('float tears the focused pane off the tree, and dock puts it back', () => {
      const floated = layoutReducer(twoPanes(), { type: 'float' });

      expect(treeOf(floated, 1)).toBe('p1:w1');
      expect(activeDesktop(floated).floats[0]?.paneId).toBe('p2');
      expect(treeOf(layoutReducer(floated, { type: 'dock' }), 1)).toBe('row(p1:w1 p2:w2)');
    });

    it('float and dock keep the state when there is nothing to move', () => {
      const empty = layoutReducer(initialDesktops('w1'), { type: 'newDesktop' });
      const docked = twoPanes();

      expect(layoutReducer(empty, { type: 'float' })).toBe(empty);
      expect(layoutReducer(docked, { type: 'dock' })).toBe(docked);
    });

    it('dockAt docks a float against the edge of a tree pane', () => {
      const floated = layoutReducer(twoPanes(), { type: 'float' });
      const docked = layoutReducer(floated, {
        type: 'dockAt',
        floatPaneId: 'p2',
        targetPaneId: 'p1',
        edge: 'top',
      });

      expect(treeOf(docked, 1)).toBe('col(p2:w2 p1:w1)');
      expect(activeDesktop(docked).floats).toStrictEqual([]);
    });
  });
});
