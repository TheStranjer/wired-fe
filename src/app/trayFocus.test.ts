/**
 * Tests for showing the tray's first description: the first alt-text input of
 * the tray takes the focus, and nothing happens while no tray is on screen.
 * The tray is found by its name in the language in use (WFE-318).
 */
import { describe, expect, it } from 'vitest';

import { showFirstDescription } from './trayFocus';
import { installFakeLocale } from '../test/i18n';

/** A tray named {@link name} holding two text inputs, `a` and `b`, in the document; the tray. */
function trayNamed(name: string): HTMLElement {
  const tray = document.createElement('div');
  const list = document.createElement('ul');
  list.setAttribute('aria-label', name);
  list.innerHTML = '<li><input type="text" id="a"></li><li><input type="text" id="b"></li>';
  tray.append(list);
  document.body.append(tray);
  return tray;
}

describe(showFirstDescription, () => {
  it('focuses the first text input of the tray', () => {
    const tray = trayNamed('Pending media');

    showFirstDescription();

    expect(document.activeElement?.id).toBe('a');

    tray.remove();
  });

  it('finds the tray by its name in the language in use, quotes and all', () => {
    installFakeLocale({ app: { pending_media: 'Medios "pendientes"' } });
    const tray = trayNamed('Medios "pendientes"');

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
