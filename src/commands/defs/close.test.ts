/**
 * Tests for /close: the status window is refused with nothing dispatched, any
 * other active window is closed by id, and arguments change neither.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './close';
import { initialWindowsState, type WindowState, type WindowsState } from '../../windows/model';
import type { CommandContext, Registry } from '../types';

/** The empty registry: /close never consults it. */
const REGISTRY: Registry = { commands: [], byName: new Map() };

/** A home window, id spelled as windowId() spells it. */
const HOME: WindowState = {
  id: 'home:lain@wired.example:-',
  ref: { kind: 'home', accountKey: 'lain@wired.example', target: null },
  title: 'home',
  unread: 0,
  highlight: false,
};

/** The status window plus a home window, with the home window active. */
function homeState(): WindowsState {
  return { windows: [...initialWindowsState().windows, HOME], activeId: HOME.id };
}

/** A context showing {@link windows}, with the window mocks kept for assertions. */
function stubContext(windows: WindowsState): {
  readonly context: CommandContext;
  readonly clearActiveWindow: Mock<CommandContext['clearActiveWindow']>;
  readonly dispatchWindows: Mock<CommandContext['dispatchWindows']>;
  readonly print: Mock<CommandContext['print']>;
} {
  const clearActiveWindow: Mock<CommandContext['clearActiveWindow']> = vi.fn();
  const dispatchWindows: Mock<CommandContext['dispatchWindows']> = vi.fn();
  const print: Mock<CommandContext['print']> = vi.fn();
  const context: CommandContext = {
    print,
    registry: REGISTRY,
    windows,
    dispatchWindows,
    clearActiveWindow,
  };
  return { context, clearActiveWindow, dispatchWindows, print };
}

describe('/close', () => {
  it('refuses to close the status window and dispatches nothing', async () => {
    const { context, dispatchWindows, clearActiveWindow, print } =
      stubContext(initialWindowsState());

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: false, message: "The status window can't be closed" });
    expect(dispatchWindows).not.toHaveBeenCalled();
    expect(clearActiveWindow).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it('closes the active window by id and returns ok', async () => {
    const { context, dispatchWindows } = stubContext(homeState());

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'close', id: HOME.id });
  });

  it('ignores its arguments and still closes the active window', async () => {
    const { context, dispatchWindows } = stubContext(homeState());

    const outcome = await command.run('2', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'close', id: HOME.id });
  });
});
