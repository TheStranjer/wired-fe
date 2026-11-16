/**
 * The one context path a healthy command registry cannot show: when the
 * definitions could not be built into a registry, commands still get a full
 * context with no commands in it, so the shell can print the reason and every
 * other command line still answers rather than throwing.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommandContext } from './useCommandContext';
import { AppStateProvider } from '../state/StateContext';
import { fakeAttachments } from '../test/commandContext';

vi.mock(import('./registry'), () => ({
  appRegistry: () => ({ ok: false, error: './defs/x.ts does not export a command' }),
}));

describe(useCommandContext, () => {
  it('builds a context with no commands in it when the registry failed', () => {
    const { result } = renderHook(() => useCommandContext(vi.fn(), vi.fn(), fakeAttachments()), {
      wrapper: AppStateProvider,
    });

    expect(result.current.registry.commands).toStrictEqual([]);
    expect(result.current.registry.byName.size).toBe(0);
    expect(result.current.windows.windows).toHaveLength(1);
  });
});
