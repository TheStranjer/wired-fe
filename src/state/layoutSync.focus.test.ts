/**
 * Keeping windows and panes in step for `/focus` and `/swap`: stepping focus
 * activates the window of the pane it lands on, and a swap carries focus with
 * the window so the active window does not change.
 */
import { describe, expect, it } from 'vitest';

import { applyLayoutAction } from './layoutSync';
import { A, B, C, focused, slice } from './layoutSyncFixtures';
import { activeDesktop } from '../windows/desktops';
import { STATUS_WINDOW_ID } from '../windows/model';

describe('/focus steps', () => {
  it('activates the window of the pane that gets focus', () => {
    const next = applyLayoutAction(slice(STATUS_WINDOW_ID, A, B), {
      type: 'focusStep',
      step: 'left',
    });

    expect(next.windows.activeId).toBe(A);
    expect(focused(next)).toBe(A);
  });

  it('cycles next around the panes and wraps', () => {
    const start = slice(STATUS_WINDOW_ID, A, B);

    const next = applyLayoutAction(start, { type: 'focusStep', step: 'next' });

    expect(next.windows.activeId).toBe(STATUS_WINDOW_ID);
  });

  it('keeps the very same slice at the edge', () => {
    const start = slice(STATUS_WINDOW_ID, A);

    expect(applyLayoutAction(start, { type: 'focusStep', step: 'right' })).toBe(start);
  });
});

describe('/swap', () => {
  it('moves the window with focus, so the active window stays the same', () => {
    const start = slice(STATUS_WINDOW_ID, A, B, C);

    const next = applyLayoutAction(start, { type: 'swap', direction: 'left' });

    expect(next.windows).toBe(start.windows);
    expect(next.windows.activeId).toBe(C);
    expect(activeDesktop(next.layout).focusedPaneId).toBe('p3');
  });
});
