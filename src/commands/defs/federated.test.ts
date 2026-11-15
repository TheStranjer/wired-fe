/**
 * Tests for /federated: with an account signed in it asks the window list for
 * that account's federated timeline window, titled plain, and reports success —
 * the window the action opens is the active one; without an account the command
 * refuses and asks for nothing; arguments change neither, and /fed is the same
 * command.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './federated';
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
};

/** The federated timeline view of {@link ACCOUNT}, as the window list names it. */
const FEDERATED = { kind: 'federated', accountKey: ACCOUNT.key, target: null } as const;

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

/** The one window ask /federated made, failing the test when it made no ask at all. */
function onlyAsk(dispatchWindows: Mock<CommandContext['dispatchWindows']>): WindowsAction {
  const call = dispatchWindows.mock.calls[0];
  if (call === undefined) {
    throw new Error('/federated asked for no window');
  }
  return call[0];
}

describe('/federated', () => {
  it('asks for the active account’s federated window, titled plain, and succeeds', async () => {
    const { context, dispatchWindows } = stubContext(true);

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith({
      type: 'open',
      ref: FEDERATED,
      title: 'federated',
    });
  });

  it('opens the window the list then shows as the active one', async () => {
    const { context, dispatchWindows } = stubContext(true);

    await command.run('', context);

    const opened = windowsReducer(context.windows, onlyAsk(dispatchWindows));

    expect(opened.activeId).toBe(windowId(FEDERATED));
    expect(opened.windows.at(-1)?.title).toBe('federated');
  });

  it('refuses with nothing signed in and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext(false);

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('ignores its arguments and opens the active account’s federated window all the same', async () => {
    const { context, dispatchWindows } = stubContext(true);

    const outcome = await command.run('spare words', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(onlyAsk(dispatchWindows)).toStrictEqual({
      type: 'open',
      ref: FEDERATED,
      title: 'federated',
    });
  });

  it('answers to /fed as well, and its usage is one word', () => {
    expect(command.aliases).toStrictEqual(['fed']);
    expect(command.usage).toBe('/federated');
  });
});
