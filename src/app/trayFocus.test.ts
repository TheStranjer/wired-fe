/**
 * Tests for showing the tray's first description: the first alt-text input of
 * the tray takes the focus, and nothing happens while no tray is on screen.
 */
import { describe, expect, it } from 'vitest';

import { PENDING_MEDIA_LABEL, showFirstDescription } from './trayFocus';

describe(showFirstDescription, () => {
  it('focuses the first text input of the tray', () => {
    const tray = document.createElement('div');
    tray.innerHTML = `<ul aria-label="${PENDING_MEDIA_LABEL}"><li><input type="text" id="a"></li><li><input type="text" id="b"></li></ul>`;
    document.body.append(tray);

    showFirstDescription();

    expect(document.activeElement?.id).toBe('a');

    tray.remove();
  });

  it('does nothing without a tray', () => {
    expect(() => {
      showFirstDescription();
    }).not.toThrow();
  });
});
