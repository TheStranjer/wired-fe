/**
 * Keeping windows and panes in step, focus and activation: a layout action
 * moves the active window, and activating a window finds it a pane, with
 * several desktops and a window shown twice where that matters.
 */
import { describe, expect, it } from 'vitest';

import { applyLayoutAction, applyWindowsAction, isVisible } from './layoutSync';
import {
  A,
  B,
  C,
  focused,
  fourWindows,
  layoutOf,
  slice,
  thread,
  unreadIn,
  unreadOf,
} from './layoutSyncFixtures';
import { activeDesktop } from '../windows/desktops';
import { STATUS_WINDOW_ID, withActive } from '../windows/model';

describe('rule 1: focus makes its window the active one', () => {
  it('focusing a pane activates its window', () => {
    const next = applyLayoutAction(slice(STATUS_WINDOW_ID, A, B), {
      type: 'focusPane',
      paneId: 'p1',
    });

    expect(next.windows.activeId).toBe(STATUS_WINDOW_ID);
  });

  it('clears the unread of the window that was focused', () => {
    const marked = unreadIn(slice(STATUS_WINDOW_ID, A), STATUS_WINDOW_ID, 3);

    const next = applyLayoutAction(marked, { type: 'focusPane', paneId: 'p1' });

    expect(unreadOf(next, STATUS_WINDOW_ID)).toBe(0);
  });

  it('splitting activates the window of the new pane', () => {
    const next = applyLayoutAction(slice(STATUS_WINDOW_ID), {
      type: 'split',
      dir: 'column',
      windowId: C,
    });

    expect(next.windows.activeId).toBe(C);
  });

  it('closing a pane activates the window of the pane that takes the focus', () => {
    const next = applyLayoutAction(slice(STATUS_WINDOW_ID, A, B), { type: 'closePane' });

    expect(next.windows.activeId).toBe(A);
  });

  it('switching to a desktop activates the window it has focused', () => {
    const moved = applyLayoutAction(slice(STATUS_WINDOW_ID, A), {
      type: 'movePaneToDesktop',
      paneId: 'p2',
      n: 2,
    });

    const next = applyLayoutAction(moved, { type: 'goToDesktop', n: 2 });

    expect(next.windows.activeId).toBe(A);
  });

  it('leaves the active window alone on an empty desktop', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    const next = applyLayoutAction(before, { type: 'newDesktop' });

    expect(next.windows).toBe(before.windows);
  });

  it('leaves the windows alone when focus stays where it was', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    const next = applyLayoutAction(before, { type: 'float' });

    expect(next.windows).toBe(before.windows);
  });

  it('hands back the very same slice when the layout does not change', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    expect(applyLayoutAction(before, { type: 'dock' })).toBe(before);
  });
});

describe('rule 2: activating a window finds it a pane', () => {
  it('focuses the pane that shows it', () => {
    const next = applyWindowsAction(slice(STATUS_WINDOW_ID, A), {
      type: 'activateNumber',
      number: 1,
    });

    expect(activeDesktop(next.layout).focusedPaneId).toBe('p1');
    expect(next.windows.activeId).toBe(STATUS_WINDOW_ID);
  });

  it('focuses the first of two panes that show it', () => {
    const away = applyWindowsAction(slice(A, B, A), { type: 'activate', id: B });

    const next = applyWindowsAction(away, { type: 'activate', id: A });

    expect(activeDesktop(next.layout).focusedPaneId).toBe('p1');
  });

  it('prefers the focused pane when it shows the window', () => {
    const before = { windows: withActive(fourWindows(), B), layout: layoutOf(A, B, A) };

    const next = applyWindowsAction(before, { type: 'activate', id: A });

    expect(next.layout).toBe(before.layout);
    expect(next.windows.activeId).toBe(A);
  });

  it('focuses a float that shows it', () => {
    const floated = applyLayoutAction(slice(STATUS_WINDOW_ID, A), { type: 'float' });
    const away = applyWindowsAction(floated, { type: 'activate', id: STATUS_WINDOW_ID });

    const next = applyWindowsAction(away, { type: 'activate', id: A });

    expect(activeDesktop(next.layout).focusedPaneId).toBe('p2');
    expect(next.windows.activeId).toBe(A);
  });

  it('shows a window that is nowhere in the focused pane', () => {
    const next = applyWindowsAction(slice(STATUS_WINDOW_ID, A), { type: 'activate', id: C });

    expect(focused(next)).toBe(C);
    expect(isVisible(next.layout, A)).toBe(false);
    expect(isVisible(next.layout, STATUS_WINDOW_ID)).toBe(true);
  });

  it('shows it in the focused float when a float has focus', () => {
    const floated = applyLayoutAction(slice(STATUS_WINDOW_ID, A), { type: 'float' });

    const next = applyWindowsAction(floated, { type: 'activate', id: B });

    expect(activeDesktop(next.layout).floats.map((float) => float.windowId)).toStrictEqual([B]);
    expect(next.windows.activeId).toBe(B);
  });

  it('shows it in the float when the tree is empty', () => {
    const floated = applyLayoutAction(slice(A), { type: 'float' });

    const next = applyWindowsAction(floated, { type: 'activate', id: B });

    expect(activeDesktop(next.layout).tree).toBeNull();
    expect(activeDesktop(next.layout).floats.map((float) => float.windowId)).toStrictEqual([B]);
  });

  it('starts an empty desktop with the first pane', () => {
    const empty = applyLayoutAction(slice(STATUS_WINDOW_ID, A), { type: 'newDesktop' });

    const next = applyWindowsAction(empty, { type: 'open', ref: thread('b'), title: 'b' });

    expect(focused(next)).toBe(B);
    expect(next.windows.activeId).toBe(B);
  });

  it('only looks at the active desktop', () => {
    const second = applyLayoutAction(slice(STATUS_WINDOW_ID, A), { type: 'newDesktop' });
    const filled = applyWindowsAction(second, { type: 'activate', id: C });

    const next = applyWindowsAction(filled, { type: 'activate', id: A });

    expect(focused(next)).toBe(A);
    expect(next.layout.desktops).toHaveLength(2);
    expect(next.layout.active).toBe(1);
  });

  it('follows next and previous too', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    expect(focused(applyWindowsAction(before, { type: 'next' }))).toBe(B);
    expect(focused(applyWindowsAction(before, { type: 'previous' }))).toBe(STATUS_WINDOW_ID);
  });

  it('leaves the layout alone when no window becomes active', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    const unknown = applyWindowsAction(before, { type: 'activate', id: 'nothing' });
    const display = applyWindowsAction(before, {
      type: 'setDisplay',
      id: A,
      overrides: { avatars: false },
    });

    expect([unknown.layout, display.layout]).toStrictEqual([before.layout, before.layout]);
  });
});
