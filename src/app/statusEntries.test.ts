/**
 * Tests for the status line's entries: the desktops with their unread sums
 * and the active marker, and the hidden windows with activity.
 */
import { describe, expect, it } from 'vitest';

import { statusEntries } from './statusEntries';
import { A, B, C, fourWindows, layoutOf } from '../state/layoutSyncFixtures';
import { goToDesktop, splitFocused } from '../windows/desktops';
import type { WindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';

/** {@link windows} with `count` unread lines given to `id`. */
function unread(windows: WindowsState, id: string, count: number): WindowsState {
  return windowsReducer(windows, { type: 'markUnread', id, count, highlight: false });
}

/** {@link windows} with a highlight, and no unread lines, given to `id`. */
function highlighted(windows: WindowsState, id: string): WindowsState {
  return windowsReducer(windows, { type: 'markUnread', id, count: 0, highlight: true });
}

describe(statusEntries, () => {
  it('lists one active desktop for the default layout', () => {
    const entries = statusEntries(layoutOf('status'), fourWindows());

    expect(entries.desktops).toStrictEqual([
      { number: 1, unread: 0, highlight: false, active: true },
    ]);
    expect(entries.windows).toStrictEqual([]);
  });

  it('lists several desktops and marks the one on screen', () => {
    const second = splitFocused(goToDesktop(layoutOf('status'), 2), 'row', A);
    const layout = goToDesktop(goToDesktop(second, 3), 2);

    const entries = statusEntries(layout, fourWindows());

    expect(entries.desktops.map(({ number, active }) => [number, active])).toStrictEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
  });

  it('sums the unread of the windows a desktop shows, each window once', () => {
    const layout = splitFocused(splitFocused(layoutOf(A), 'row', B), 'row', A);
    const windows = highlighted(unread(unread(fourWindows(), A, 2), B, 3), B);

    const entries = statusEntries(layout, windows);

    expect(entries.desktops).toStrictEqual([
      { number: 1, unread: 5, highlight: true, active: true },
    ]);
  });

  it('counts a window under every desktop that shows it', () => {
    const second = goToDesktop(splitFocused(layoutOf('status'), 'row', A), 2);
    const layout = splitFocused(second, 'row', A);

    const entries = statusEntries(layout, unread(fourWindows(), A, 4));

    expect(entries.desktops.map((entry) => entry.unread)).toStrictEqual([4, 4]);
  });

  it('lists hidden windows with activity, numbered by display order', () => {
    const windows = highlighted(unread(fourWindows(), A, 2), C);

    const entries = statusEntries(layoutOf('status'), windows);

    expect(entries.windows).toStrictEqual([
      { number: 2, title: 'a', unread: 2, highlight: false },
      { number: 4, title: 'c', unread: 0, highlight: true },
    ]);
  });

  it('leaves out windows without activity and windows the active desktop shows', () => {
    const windows = unread(unread(fourWindows(), A, 2), B, 1);
    const layout = layoutOf('status', A);

    const entries = statusEntries(layout, windows);

    expect(entries.windows.map((entry) => entry.title)).toStrictEqual(['b']);
  });

  it('lists a window shown only on another desktop as hidden', () => {
    const layout = goToDesktop(splitFocused(layoutOf('status'), 'row', A), 2);

    const entries = statusEntries(layout, unread(fourWindows(), A, 1));

    expect(entries.windows.map((entry) => entry.title)).toStrictEqual(['a']);
    expect(entries.desktops.map((entry) => entry.unread)).toStrictEqual([1, 0]);
  });
});
