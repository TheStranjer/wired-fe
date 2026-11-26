/**
 * Tests for the way back to the command line (WFE-284): until the line
 * registers its restorer nothing is restored; a registered restorer fills an
 * empty line and answers that it did, and leaves a line with text in it alone.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useLineRestoreApi, useRegisterLineRestorer } from './useLineRestoreApi';

/** The api, with a line holding {@link value} registered over it when asked. */
function mount(value: string, registered: boolean) {
  const setValue = vi.fn();
  const { result } = renderHook(() => {
    const api = useLineRestoreApi();
    useRegisterLineRestorer({ value, setValue }, registered ? api.register : () => undefined);
    return api;
  });
  return { api: result.current, setValue };
}

describe(useLineRestoreApi, () => {
  it('restores nothing before a line has registered', () => {
    const { api, setValue } = mount('', false);

    expect(api.restore('lost')).toBe(false);
    expect(setValue).not.toHaveBeenCalled();
  });

  it('fills an empty line', () => {
    const { api, setValue } = mount('', true);

    expect(api.restore('lost')).toBe(true);
    expect(setValue).toHaveBeenCalledWith('lost');
  });

  it('never overwrites a line that holds text', () => {
    const { api, setValue } = mount('typed', true);

    expect(api.restore('lost')).toBe(false);
    expect(setValue).not.toHaveBeenCalled();
  });
});
