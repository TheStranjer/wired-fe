/**
 * Tests for navigating an open dropdown menu: arrows with wrap, Home and End,
 * and type-ahead, always skipping disabled items.
 */
import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MenuButton } from './MenuButton';
import { openByClick, row } from './menuHarness';

describe(MenuButton, () => {
  it('moves with the arrows, wrapping and skipping disabled items', () => {
    openByClick();

    fireEvent.keyDown(row('Alpha'), { key: 'ArrowDown' });

    expect(row('Gamma')).toHaveFocus();

    fireEvent.keyDown(row('Gamma'), { key: 'ArrowDown' });

    expect(row('Delta')).toHaveFocus();

    fireEvent.keyDown(row('Delta'), { key: 'ArrowDown' });

    expect(row('Alpha')).toHaveFocus();

    fireEvent.keyDown(row('Alpha'), { key: 'ArrowUp' });

    expect(row('Delta')).toHaveFocus();

    fireEvent.keyDown(row('Delta'), { key: 'ArrowUp' });

    expect(row('Gamma')).toHaveFocus();
  });

  it('jumps to the first and last enabled items on Home and End', () => {
    openByClick();

    fireEvent.keyDown(row('Alpha'), { key: 'End' });

    expect(row('Delta')).toHaveFocus();

    fireEvent.keyDown(row('Delta'), { key: 'Home' });

    expect(row('Alpha')).toHaveFocus();
  });

  it('jumps to the next item starting with a typed letter, ignoring case', () => {
    openByClick();

    fireEvent.keyDown(row('Alpha'), { key: 'g' });

    expect(row('Gamma')).toHaveFocus();

    fireEvent.keyDown(row('Gamma'), { key: 'D' });

    expect(row('Delta')).toHaveFocus();

    fireEvent.keyDown(row('Delta'), { key: 'a' });

    expect(row('Alpha')).toHaveFocus();
  });

  it('keeps focus for a letter that matches nothing enabled, a chord or a stray key', () => {
    openByClick();

    fireEvent.keyDown(row('Alpha'), { key: 'b' });
    fireEvent.keyDown(row('Alpha'), { key: 'z' });
    fireEvent.keyDown(row('Alpha'), { key: 'g', ctrlKey: true });
    fireEvent.keyDown(row('Alpha'), { key: 'F1' });

    expect(row('Alpha')).toHaveFocus();
  });
});
