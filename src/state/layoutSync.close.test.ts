/**
 * Keeping windows and panes in step, closing and unread: a closed window's
 * panes close on every desktop, hidden windows count unread, visible ones do
 * not.
 */
import { describe, expect, it } from 'vitest';

import { applyLayoutAction, applyWindowsAction } from './layoutSync';
import { A, B, C, focused, fourWindows, shownOn, slice, unreadOf } from './layoutSyncFixtures';
import { activeDesktop, initialDesktops } from '../windows/desktops';
import { STATUS_WINDOW_ID, withActive } from '../windows/model';

describe('rule 3: closing a window closes its panes everywhere', () => {
  it('closes every pane and float showing it, on every desktop', () => {
    const first = applyLayoutAction(slice(A, B, A), { type: 'float' });
    const second = applyWindowsAction(applyLayoutAction(first, { type: 'newDesktop' }), {
      type: 'activate',
      id: B,
    });
    const shown = applyWindowsAction(second, { type: 'activate', id: A });

    const next = applyWindowsAction(shown, { type: 'close', id: A });

    expect(next.windows.windows.map((win) => win.id)).not.toContain(A);
    expect(shownOn(shown.layout, A)).toStrictEqual([true, true]);
    expect(shownOn(next.layout, A)).toStrictEqual([false, false]);
  });

  it('keeps the panes of the other windows', () => {
    const shown = applyLayoutAction(slice(A, B, A), { type: 'float' });

    const next = applyWindowsAction(shown, { type: 'close', id: A });

    expect(shownOn(next.layout, B)).toStrictEqual([true]);
  });

  it('activates the window of the pane that takes the focus', () => {
    const next = applyWindowsAction(slice(STATUS_WINDOW_ID, B, A), { type: 'close', id: A });

    expect(focused(next)).toBe(B);
    expect(next.windows.activeId).toBe(B);
  });

  it('leaves the layout and the active window alone for a window nobody shows', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    const next = applyWindowsAction(before, { type: 'close', id: C });

    expect(next.layout).toBe(before.layout);
    expect(next.windows.activeId).toBe(A);
  });

  it('leaves an empty desktop when its only pane closes', () => {
    const only = { windows: withActive(fourWindows(), A), layout: initialDesktops(A) };

    const next = applyWindowsAction(only, { type: 'close', id: A });

    expect(activeDesktop(next.layout).focusedPaneId).toBeNull();
    expect(next.windows.activeId).toBe(STATUS_WINDOW_ID);
  });

  it('does nothing for the status window, which cannot close', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    const next = applyWindowsAction(before, { type: 'close', id: STATUS_WINDOW_ID });

    expect(next.layout).toBe(before.layout);
    expect(next.windows).toBe(before.windows);
  });
});

describe('rule 4 and 5: hidden windows count unread, visible ones do not', () => {
  it('counts unread for a window shown nowhere, which stays open', () => {
    const next = applyWindowsAction(slice(STATUS_WINDOW_ID, A), {
      type: 'markUnread',
      id: C,
      count: 2,
      highlight: true,
    });

    expect(unreadOf(next, C)).toBe(2);
  });

  it('counts nothing for a window visible in a pane that is not focused', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    const next = applyWindowsAction(before, {
      type: 'markUnread',
      id: STATUS_WINDOW_ID,
      count: 2,
      highlight: false,
    });

    expect(next).toBe(before);
  });

  it('counts unread for a window shown only on another desktop', () => {
    const empty = applyLayoutAction(slice(STATUS_WINDOW_ID, A), { type: 'newDesktop' });
    const away = applyWindowsAction(empty, { type: 'activate', id: B });

    const next = applyWindowsAction(away, {
      type: 'markUnread',
      id: A,
      count: 1,
      highlight: false,
    });

    expect(unreadOf(next, A)).toBe(1);
  });

  it('does not touch the layout when a window is read', () => {
    const before = slice(STATUS_WINDOW_ID, A);

    expect(applyWindowsAction(before, { type: 'markRead', id: A }).layout).toBe(before.layout);
  });
});
