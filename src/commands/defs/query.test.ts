/**
 * Tests for /query (alias /q): with an account signed in a handle — with or
 * without its leading `@`, in any case, remote or local — asks the window
 * list for that account's dm window, keyed and titled by the normalized
 * handle, and reports success; the window the action opens is the active
 * one, and querying the same person again finds that same window. Anything
 * that is not a handle is refused with the usage and asks for nothing, and
 * with nobody signed in even a good handle only says to log in.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './query';
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

/** Alice's dm view of {@link ACCOUNT}, as /query keys and titles it. */
const ALICE = { kind: 'dm', accountKey: ACCOUNT.key, target: 'alice@other.example' } as const;
const OPEN_ALICE: WindowsAction = {
  type: 'open',
  ref: ALICE,
  title: 'dm/alice@other.example',
};

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
function stubContext(signed = true): {
  readonly context: CommandContext;
  readonly dispatchWindows: Mock<CommandContext['dispatchWindows']>;
} {
  const dispatchWindows: Mock<CommandContext['dispatchWindows']> = vi.fn();
  return {
    context: fakeCommandContext({ state: session(signed), dispatchWindows }),
    dispatchWindows,
  };
}

/** The one window ask the command made, failing the test when it made none. */
function onlyAsk(dispatchWindows: Mock<CommandContext['dispatchWindows']>): WindowsAction {
  const call = dispatchWindows.mock.calls[0];
  if (call === undefined) {
    throw new Error('/query asked for no window');
  }
  return call[0];
}

describe('/query', () => {
  it('asks for the active account’s dm window with alice, titled and keyed without the @', async () => {
    const { context, dispatchWindows } = stubContext();

    const outcome = await command.run('  @Alice@Other.Example  ', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(onlyAsk(dispatchWindows)).toStrictEqual(OPEN_ALICE);
  });

  it('takes a handle typed without the @ just the same', async () => {
    const { context, dispatchWindows } = stubContext();

    await expect(command.run('alice@other.example', context)).resolves.toStrictEqual({ ok: true });

    expect(onlyAsk(dispatchWindows)).toStrictEqual(OPEN_ALICE);
  });

  it('keeps a local handle bare, with or without the @', async () => {
    for (const args of ['@alice', 'alice']) {
      const { context, dispatchWindows } = stubContext();

      await expect(command.run(args, context)).resolves.toStrictEqual({ ok: true });

      expect(onlyAsk(dispatchWindows)).toStrictEqual({
        type: 'open',
        ref: { kind: 'dm', accountKey: ACCOUNT.key, target: 'alice' },
        title: 'dm/alice',
      });
    }
  });

  it('opens the window the list then shows as the active one', async () => {
    const { context, dispatchWindows } = stubContext();

    await command.run('@alice@other.example', context);

    const opened = windowsReducer(context.windows, onlyAsk(dispatchWindows));

    expect(opened.activeId).toBe(windowId(ALICE));
    expect(opened.windows.at(-1)?.title).toBe('dm/alice@other.example');
  });

  it('queries somebody twice into the one window the list already shows', async () => {
    const { context, dispatchWindows } = stubContext();

    await command.run('@Alice@Other.Example', context);
    const asked = windowsReducer(context.windows, onlyAsk(dispatchWindows));
    const again = windowsReducer(asked, OPEN_ALICE);

    expect(again.windows).toHaveLength(2);
    expect(again.windows.at(1)?.id).toBe(windowId(ALICE));
  });

  it('refuses a word that is not a handle and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext();

    for (const args of ['', '   ', 'two words', '@', '@@x', '@user@', '@user@ho!', '!!']) {
      await expect(command.run(args, context)).resolves.toStrictEqual({
        ok: false,
        message: 'Usage: /query <@handle>',
      });
    }

    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses with nothing signed in and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext(false);

    const outcome = await command.run('@alice@other.example', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('is answered by /q and shows its name in usage', () => {
    expect(command.name).toBe('query');
    expect(command.aliases).toStrictEqual(['q']);
    expect(command.usage).toBe('/query <@handle>');
    expect(command.summary).toBe('Open a private conversation window');
  });
});
