/**
 * Tests for /clear: it empties the active window exactly once and reports ok,
 * whatever arguments it was handed.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './clear';
import { initialWindowsState } from '../../windows/model';
import type { CommandContext, Registry } from '../types';

/** The empty registry: /clear never consults it. */
const REGISTRY: Registry = { commands: [], byName: new Map() };

/** A context whose window layer is mocks, with the mocks kept for assertions. */
function stubContext(): {
  readonly context: CommandContext;
  readonly clearActiveWindow: Mock<CommandContext['clearActiveWindow']>;
  readonly dispatchWindows: Mock<CommandContext['dispatchWindows']>;
} {
  const clearActiveWindow: Mock<CommandContext['clearActiveWindow']> = vi.fn();
  const dispatchWindows: Mock<CommandContext['dispatchWindows']> = vi.fn();
  const context: CommandContext = {
    print: vi.fn(),
    registry: REGISTRY,
    windows: initialWindowsState(),
    dispatchWindows,
    clearActiveWindow,
  };
  return { context, clearActiveWindow, dispatchWindows };
}

describe('/clear', () => {
  it('clears the active window once and returns ok', async () => {
    const { context, clearActiveWindow, dispatchWindows } = stubContext();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(clearActiveWindow).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('ignores its arguments and still clears once', async () => {
    const { context, clearActiveWindow } = stubContext();

    const outcome = await command.run('every window please', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(clearActiveWindow).toHaveBeenCalledTimes(1);
  });
});
