/**
 * Tests for the emoji picker's keys (WFE-265): ArrowDown steps from the search
 * field into the grid, the arrows, Home and End walk it, Enter and Space
 * choose, ArrowUp from the first row returns to the search field, Enter in the
 * field takes the first match, and only the focused cell is a tab stop.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderPicker, search } from './emojiPickerHarness';

/** The cell named {@link name}. */
function cell(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('the picker’s keys', () => {
  it('steps from the search field into the grid with ArrowDown', () => {
    renderPicker();

    fireEvent.keyDown(search(), { key: 'ArrowDown' });

    expect(cell('🔥')).toHaveFocus();
  });

  it.each([
    ['🔥', 'ArrowRight', ':party:'],
    [':party:', 'End', 'fire'],
    ['fire', 'ArrowLeft', 'fire engine'],
    ['fire engine', 'Home', '🔥'],
    ['🔥', 'ArrowDown', 'fire'],
  ])('moves from %s with %s to %s', (from, key, to) => {
    renderPicker();
    fireEvent.focus(cell(from));

    fireEvent.keyDown(cell(from), { key });

    expect(cell(to)).toHaveFocus();
  });

  it('chooses the focused cell with Enter', () => {
    const spies = renderPicker();
    fireEvent.focus(cell('fire'));

    fireEvent.keyDown(cell('fire'), { key: 'Enter' });

    expect(spies.onChoose).toHaveBeenCalledExactlyOnceWith('🔥', false);
  });

  it('chooses with Space', () => {
    const spies = renderPicker();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });

    fireEvent.keyDown(cell('🔥'), { key: ' ' });

    expect(spies.onChoose).toHaveBeenCalledExactlyOnceWith('🔥', true);
  });

  it('leaves the first row upwards for the search field', () => {
    renderPicker();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });

    fireEvent.keyDown(cell('🔥'), { key: 'ArrowUp' });

    expect(search()).toHaveFocus();
  });

  it('makes only the focused cell a tab stop', () => {
    renderPicker();

    expect(cell('🔥')).toHaveAttribute('tabindex', '0');

    fireEvent.focus(cell('pizza'));

    expect(cell('🔥')).toHaveAttribute('tabindex', '-1');
    expect(cell('pizza')).toHaveAttribute('tabindex', '0');
  });

  it('ignores a key that does not navigate', () => {
    const spies = renderPicker();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });

    fireEvent.keyDown(cell('🔥'), { key: 'a' });

    expect(cell('🔥')).toHaveFocus();
    expect(spies.onChoose).not.toHaveBeenCalled();
  });

  it('takes the first match with Enter in the search field', () => {
    const spies = renderPicker();
    fireEvent.change(search(), { target: { value: 'pizza' } });

    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(spies.onChoose).toHaveBeenCalledExactlyOnceWith('🍕', false);
  });

  it('takes nothing with Enter when nothing matches', () => {
    const spies = renderPicker();
    fireEvent.change(search(), { target: { value: 'zzzz' } });

    fireEvent.keyDown(search(), { key: 'Enter' });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });

    expect(spies.onChoose).not.toHaveBeenCalled();
    expect(search()).toHaveFocus();
  });

  it('leaves other keys in the search field to the field', () => {
    const spies = renderPicker();

    fireEvent.keyDown(search(), { key: 'a' });

    expect(spies.onChoose).not.toHaveBeenCalled();
    expect(search()).toHaveFocus();
  });
});
