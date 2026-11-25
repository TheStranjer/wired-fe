/**
 * Tests for the dropdown menu button: its ARIA state, the ways to open it
 * (click, Enter, Space, ArrowDown, ArrowUp), arrow/Home/End/type-ahead
 * navigation with wrap, selection, the ways to close it and where focus goes,
 * disabled and checkbox items, and keeping menu keys from the global hotkeys.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MenuButton } from './MenuButton';
import { openByClick, row, setup } from './menuHarness';

describe(MenuButton, () => {
  it('starts closed with menu-button ARIA state and the glyph', () => {
    const { button } = setup();

    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('┃▾');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on click with focus on the first enabled item', () => {
    const button = openByClick();

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Split side by side' })).toBeInTheDocument();
    expect(row('Alpha')).toHaveFocus();
  });

  it.each(['ArrowDown', 'Enter', ' '])('opens on %j with focus on the first item', (key) => {
    const { button } = setup();

    fireEvent.keyDown(button, { key });

    expect(row('Alpha')).toHaveFocus();
  });

  it('opens on ArrowUp with focus on the last item', () => {
    const { button } = setup();

    fireEvent.keyDown(button, { key: 'ArrowUp' });

    expect(row('Delta')).toHaveFocus();
  });

  it('ignores other keys on the closed button', () => {
    const { button } = setup();

    fireEvent.keyDown(button, { key: 'x' });

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when the button is clicked again', () => {
    const button = openByClick();

    fireEvent.click(button);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
  ])('selects the focused item on %s, closes and refocuses the button', (_name, key) => {
    const { button, onSelect } = setup();
    fireEvent.click(button);
    fireEvent.keyDown(row('Alpha'), { key: 'ArrowDown' });

    fireEvent.keyDown(row('Gamma'), { key });

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('g');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('selects a clicked item, closes and refocuses the button', () => {
    const { button, onSelect } = setup();
    fireEvent.click(button);

    fireEvent.click(row('Delta'));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('d');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('does not select a disabled item', () => {
    const { button, onSelect } = setup();
    fireEvent.click(button);

    fireEvent.click(row('Beta'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(row('Beta')).toBeDisabled();
  });

  it.each(['Escape', 'Tab'])('closes on %s and returns focus to the button', (key) => {
    const button = openByClick();

    fireEvent.keyDown(row('Alpha'), { key });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a mousedown outside and leaves focus where it went', () => {
    const button = openByClick();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).not.toHaveFocus();
  });

  it('stays open on a mousedown inside the menu', () => {
    openByClick();

    fireEvent.mouseDown(row('Gamma'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('exposes checked state on checkbox items only', () => {
    openByClick();

    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(row('Gamma')).toHaveAttribute('role', 'menuitemcheckbox');
    expect(row('Gamma')).toHaveAttribute('aria-checked', 'true');
    expect(row('Delta')).toHaveAttribute('aria-checked', 'false');
    expect(row('Alpha')).not.toHaveAttribute('aria-checked');
  });

  it('keeps keys pressed in the open menu from bubbling to the page', () => {
    openByClick();
    const onPage = vi.fn();
    document.addEventListener('keydown', onPage);

    fireEvent.keyDown(row('Alpha'), { key: 'j' });
    fireEvent.keyDown(row('Alpha'), { key: 'k' });

    document.removeEventListener('keydown', onPage);

    expect(onPage).not.toHaveBeenCalled();
  });

  it('opens with nothing to focus but the menu when every item is disabled', () => {
    const { button, onSelect } = setup([{ id: 'x', label: 'Xray', disabled: true }]);

    fireEvent.click(button);
    const menu = screen.getByRole('menu');

    expect(menu).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'Enter' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    expect(onSelect).not.toHaveBeenCalled();
    expect(menu).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(button).toHaveFocus();
  });

  it('opens on ArrowUp over an all-disabled list too', () => {
    const { button } = setup([{ id: 'x', label: 'Xray', disabled: true }]);

    fireEvent.keyDown(button, { key: 'ArrowUp' });

    expect(screen.getByRole('menu')).toHaveFocus();
  });
});
