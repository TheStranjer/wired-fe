/**
 * Tests for /win: jumping by number, cycling, reordering and listing. The
 * window state is built with the reducer, and the context records every
 * dispatchWindows action and every printed line.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './win';
import { fakeCommandContext } from '../../test/commandContext';
import {
  STATUS_WINDOW_ID,
  initialWindowsState,
  windowId,
  type WindowRef,
  type WindowsState,
} from '../../windows/model';
import { windowsReducer } from '../../windows/reducer';
import type { CommandContext } from '../types';

/** The home and notifications views the three-window fixture shows. */
const HOME: WindowRef = { kind: 'home', accountKey: 'lain@wired.example', target: null };
const NOTIFICATIONS: WindowRef = {
  kind: 'notifications',
  accountKey: 'lain@wired.example',
  target: null,
};

/** Status, home and notifications, in that order, with notifications active. */
function threeWindows(): WindowsState {
  const withHome = windowsReducer(initialWindowsState(), {
    type: 'open',
    ref: HOME,
    title: 'home',
  });
  return windowsReducer(withHome, { type: 'open', ref: NOTIFICATIONS, title: 'notifications' });
}

/** {@link threeWindows} with the status window brought back to the front. */
function statusActive(): WindowsState {
  return windowsReducer(threeWindows(), { type: 'activate', id: STATUS_WINDOW_ID });
}

/** A context over {@link windows} whose window layer is recording mocks. */
function stubContext(windows: WindowsState): {
  readonly context: CommandContext;
  readonly dispatchWindows: Mock<CommandContext['dispatchWindows']>;
  readonly print: Mock<CommandContext['print']>;
} {
  const dispatchWindows: Mock<CommandContext['dispatchWindows']> = vi.fn();
  const print: Mock<CommandContext['print']> = vi.fn();
  return {
    context: fakeCommandContext({ windows, dispatchWindows, print }),
    dispatchWindows,
    print,
  };
}

describe('/win', () => {
  it('activates an existing window by number', async () => {
    const { context, dispatchWindows, print } = stubContext(threeWindows());

    const outcome = await command.run('2', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'activateNumber', number: 2 });
    expect(print).not.toHaveBeenCalled();
  });

  it('refuses a number past the end of the list', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('9', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No window 9' });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('cycles forward with next', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('next', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'next' });
  });

  it('cycles backward with prev', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('prev', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'previous' });
  });

  it('cycles backward with the previous spelling too', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('previous', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'previous' });
  });

  it('moves the active window to another number', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('move 2', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith({
      type: 'move',
      id: windowId(NOTIFICATIONS),
      toNumber: 2,
    });
  });

  it('refuses to move the status window', async () => {
    const { context, dispatchWindows } = stubContext(statusActive());

    const outcome = await command.run('move 2', context);

    expect(outcome).toStrictEqual({ ok: false, message: "Can't move this window there" });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses to move a window into the status window slot', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('move 1', context);

    expect(outcome).toStrictEqual({ ok: false, message: "Can't move this window there" });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses to move past the end of the list', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('move 9', context);

    expect(outcome).toStrictEqual({ ok: false, message: "Can't move this window there" });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('prints the window list, marking the active window and its unread', async () => {
    const marked = windowsReducer(threeWindows(), {
      type: 'markUnread',
      id: windowId(HOME),
      count: 3,
      highlight: true,
    });
    const { context, dispatchWindows, print } = stubContext(marked);

    const outcome = await command.run('list', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      ['  1: status'],
      ['  2: home (3 unread) *'],
      ['> 3: notifications'],
    ]);
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('lists the windows when given no arguments', async () => {
    const { context, print } = stubContext(threeWindows());

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      ['  1: status'],
      ['  2: home'],
      ['> 3: notifications'],
    ]);
  });

  it('reports the usage for an unknown word', async () => {
    const { context, dispatchWindows, print } = stubContext(threeWindows());

    const outcome = await command.run('banana', context);

    expect(outcome).toStrictEqual({ ok: false, message: `Usage: ${command.usage}` });
    expect(dispatchWindows).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it('reports the usage for window zero, which is not a positive number', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('0', context);

    expect(outcome).toStrictEqual({ ok: false, message: `Usage: ${command.usage}` });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('reports the usage for a move with no number', async () => {
    const { context, dispatchWindows } = stubContext(threeWindows());

    const outcome = await command.run('move', context);

    expect(outcome).toStrictEqual({ ok: false, message: `Usage: ${command.usage}` });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });
});
