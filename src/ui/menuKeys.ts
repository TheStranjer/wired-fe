/**
 * Keys of a {@link MenuButton}: on the closed button, which open the menu; in
 * the open menu, which close it, which select and which move focus. Every key
 * pressed in the open menu stops here so the global hotkeys (`j`, `k`, ...)
 * never fire under it.
 */
import type { KeyboardEvent } from 'react';

import { firstEnabled, lastEnabled, navTarget } from './menuNav';
import type { MenuItem } from './menuNav';

/** What the open menu can read and ask for. */
export type MenuControls = {
  /** The rows, in order. */
  readonly items: readonly MenuItem[];
  /** Moves focus to another row. */
  readonly setActive: (index: number) => void;
  /** Closes the menu and hands focus back to the button. */
  readonly close: () => void;
  /** Reports the chosen row's id, then closes. */
  readonly select: (id: string) => void;
};

/**
 * Handle Tab, Escape, Enter and Space; true when the key was one of them.
 * Tab closes without cancelling, so focus carries on from the button.
 */
function commandKey(event: KeyboardEvent, controls: MenuControls, active: number): boolean {
  switch (event.key) {
    case 'Tab':
      controls.close();
      return true;
    case 'Escape':
      event.preventDefault();
      controls.close();
      return true;
    case 'Enter':
    case ' ': {
      event.preventDefault();
      const item = controls.items[active];
      if (item !== undefined) {
        controls.select(item.id);
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * One keydown inside the open menu whose focused row is `active` (-1 when no
 * row can take focus). Navigation keys move focus; keys that mean nothing to
 * the menu are swallowed all the same.
 */
export function onMenuKey(event: KeyboardEvent, controls: MenuControls, active: number): void {
  event.stopPropagation();
  if (commandKey(event, controls, active)) {
    return;
  }
  const target = navTarget(controls.items, active, event);
  if (target !== null) {
    event.preventDefault();
    if (target >= 0) {
      controls.setActive(target);
    }
  }
}

/**
 * One keydown on the closed button: ArrowUp opens the menu on its last
 * enabled row, ArrowDown, Enter and Space on its first. `open` receives the
 * row to focus (-1 when every row is disabled).
 */
export function onButtonKey(
  event: KeyboardEvent,
  items: readonly MenuItem[],
  open: (index: number) => void,
): void {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    open(lastEnabled(items));
  } else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    open(firstEnabled(items));
  }
}
