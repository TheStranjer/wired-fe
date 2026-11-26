/**
 * Shared setup for the MenuButton tests: a fixed set of rows, a renderer that
 * returns the button and the select spy, and lookups for rows of the open menu.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { MenuButton } from './MenuButton';
import type { MenuItem } from './MenuButton';

/** Enabled, disabled, ticked and unticked rows, in that order. */
const ITEMS: readonly MenuItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta', disabled: true },
  { id: 'g', label: 'Gamma', checked: true },
  { id: 'd', label: 'Delta', checked: false },
];

/** The button's name; a test helper writes English on purpose. */
const BUTTON_NAME = 'Split side by side';

/** Renders the button over `items`; returns it and the select spy. */
export function setup(items: readonly MenuItem[] = ITEMS): {
  button: HTMLElement;
  onSelect: (id: string) => void;
} {
  const onSelect = vi.fn<(id: string) => void>();
  render(<MenuButton glyph="◫▾" items={items} label={BUTTON_NAME} onSelect={onSelect} />);
  return { button: screen.getByRole('button', { name: BUTTON_NAME }), onSelect };
}

/** The open menu's row with the given text. */
export function row(name: string): HTMLElement {
  return screen.getByText(name);
}

/** Opens by click; returns the button. */
export function openByClick(): HTMLElement {
  const { button } = setup();
  fireEvent.click(button);
  return button;
}
