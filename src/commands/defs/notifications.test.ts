/**
 * Tests for /notifications: with an account signed in it asks the window list
 * for that account's notifications window, titled plain `notifs`, and reports
 * success — the window the action opens is the active one; without an account
 * the command refuses and asks for nothing, and /n and /notifs are the same
 * command (the text after it is tested in ../openWindowRun.post.test.ts).
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './notifications';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import { fakeCommandContext } from '../../test/commandContext';
import { windowId } from '../../windows/model';
import { type WindowsAction, windowsReducer } from '../../windows/reducer';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The one account these sessions have. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The notifications view of {@link ACCOUNT}, as the window list names it. */
const NOTIFICATIONS = { kind: 'notifications', accountKey: ACCOUNT.key, target: null } as const;

/** A session signed in as {@link ACCOUNT}, or one with nobody signed in. */
function session(signed: boolean): AppState {
  if (!signed) {
    return initialAppState();
  }
  return coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
}

/** A command context over that session, keeping the window asks for assertions. */
function stubContext(signed: boolean): {
  readonly context: CommandContext;
  readonly dispatchWindows: Mock<CommandContext['dispatchWindows']>;
} {
  const dispatchWindows: Mock<CommandContext['dispatchWindows']> = vi.fn();
  return {
    context: fakeCommandContext({ state: session(signed), dispatchWindows }),
    dispatchWindows,
  };
}

/** The one window ask /notifications made, failing the test when it made no ask at all. */
function onlyAsk(dispatchWindows: Mock<CommandContext['dispatchWindows']>): WindowsAction {
  const call = dispatchWindows.mock.calls[0];
  if (call === undefined) {
    throw new Error('/notifications asked for no window');
  }
  return call[0];
}

describe('/notifications', () => {
  it('asks for the active account’s notifications window, titled notifs, and succeeds', async () => {
    const { context, dispatchWindows } = stubContext(true);

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith({
      type: 'open',
      ref: NOTIFICATIONS,
      title: 'notifs',
    });
  });

  it('opens the window the list then shows as the active one', async () => {
    const { context, dispatchWindows } = stubContext(true);

    await command.run('', context);

    const opened = windowsReducer(context.windows, onlyAsk(dispatchWindows));

    expect(opened.activeId).toBe(windowId(NOTIFICATIONS));
    expect(opened.windows.at(-1)?.title).toBe('notifs');
  });

  it('refuses with nothing signed in and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext(false);

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('answers to /n and /notifs as well, and its usage shows the text and --in', () => {
    expect(command.aliases).toStrictEqual(['n', 'notifs']);
    expect(command.usage).toBe('/notifications [text] [--in <placement>]');
  });
});
