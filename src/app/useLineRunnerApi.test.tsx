/**
 * Tests for the line runner the app lends: before the command line registers
 * one every run is refused, afterwards the newest registered runner runs the
 * lines, and the runner the command line registers runs them as its context.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useLineRunnerApi, useRegisterLineRunner } from './useLineRunnerApi';
import { fakeCommandContext } from '../test/commandContext';
import type { LineRunner } from '../views/LineRunnerContext';

/** The runner {@link register} was first called with, failing when it never was. */
function registered(register: {
  readonly mock: { readonly calls: readonly [LineRunner][] };
}): LineRunner {
  const runner = register.mock.calls[0]?.[0];
  if (runner === undefined) {
    throw new Error('no runner was registered');
  }
  return runner;
}

describe(useLineRunnerApi, () => {
  it('refuses to run lines before a runner registers', async () => {
    const { result } = renderHook(() => useLineRunnerApi());

    await expect(result.current.runner(['/feed list'])).resolves.toStrictEqual({
      ok: false,
      message: 'The command line is not ready',
    });
  });

  it('runs lines through the runner registered last', async () => {
    const { result } = renderHook(() => useLineRunnerApi());
    const first = vi.fn<LineRunner>().mockResolvedValue({ ok: true });
    const second = vi.fn<LineRunner>().mockResolvedValue({ ok: false, message: 'no' });
    act(() => {
      result.current.register(first);
      result.current.register(second);
    });

    await expect(result.current.runner(['/feed list'])).resolves.toStrictEqual({
      ok: false,
      message: 'no',
    });

    expect(second).toHaveBeenCalledWith(['/feed list']);
    expect(first).not.toHaveBeenCalled();
  });
});

describe(useRegisterLineRunner, () => {
  it('registers a runner that runs lines as the context', async () => {
    const register = vi.fn<(runner: LineRunner) => void>();
    renderHook(() => {
      useRegisterLineRunner(fakeCommandContext(), register);
    });

    await expect(registered(register)(['/nothing'])).resolves.toStrictEqual({
      ok: false,
      message: 'Unknown command: /nothing',
    });
  });
});
