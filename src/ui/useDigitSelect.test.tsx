/**
 * Tests for the account picker's keyboard hooks (WFE-282) where no form is
 * mounted yet: a null ref makes both of them do nothing.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useChosenFocus, useDigitSelect } from './useDigitSelect';

describe(useDigitSelect, () => {
  it('does nothing without a form', () => {
    const choose = vi.fn<(key: string) => void>();

    renderHook(() => {
      useDigitSelect({ current: null }, ['k1'], choose);
    });

    expect(choose).not.toHaveBeenCalled();
  });
});

describe(useChosenFocus, () => {
  it('does nothing without a form', () => {
    const focused = document.activeElement;

    renderHook(() => {
      useChosenFocus({ current: null });
    });

    expect(document.activeElement).toBe(focused);
  });
});
