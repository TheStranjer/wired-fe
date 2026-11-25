/**
 * Tests for the line-runner seam: a tree with no provider refuses every run,
 * a provider's runner is what the hook returns, and the provider renders its
 * children.
 */
import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LineRunnerProvider, useLineRunner } from './LineRunnerContext';
import type { LineRunner } from './LineRunnerContext';

describe(useLineRunner, () => {
  it('refuses to run anything without a provider', async () => {
    const { result } = renderHook(() => useLineRunner());

    await expect(result.current(['/feed list'])).resolves.toStrictEqual({
      ok: false,
      message: 'The command line is not available',
    });
  });

  it('returns the runner the provider holds', () => {
    const runner = vi.fn<LineRunner>();
    const { result } = renderHook(() => useLineRunner(), {
      wrapper: ({ children }) => (
        <LineRunnerProvider runner={runner}>{children}</LineRunnerProvider>
      ),
    });

    expect(result.current).toBe(runner);
  });

  it('renders its children', () => {
    render(
      <LineRunnerProvider runner={vi.fn<LineRunner>()}>
        <p>inside</p>
      </LineRunnerProvider>,
    );

    expect(screen.getByText('inside')).toBeInTheDocument();
  });
});
