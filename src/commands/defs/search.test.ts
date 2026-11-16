/**
 * Tests for /search (alias /s): with an account signed in a query — trimmed,
 * but otherwise exactly what was typed, case and inner spaces included — asks
 * the window list for that account's search window, targeted at the whole
 * query and titled with its first twenty characters, and reports success; the
 * window the action opens is the active one, and searching the same query
 * again finds that same window. A line of nothing but spaces is refused with
 * the usage and asks for nothing, and with nobody signed in even a good query
 * only says to log in.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './search';
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

/** A query beyond the title's twenty characters; the target keeps it all. */
const LONG_QUERY = 'the Network of all lines is one';

/** The lain query of {@link ACCOUNT}, as the window list names it. */
const LAIN = { kind: 'search', accountKey: ACCOUNT.key, target: 'lain' } as const;

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
    throw new Error('/search asked for no window');
  }
  return call[0];
}

describe('/search', () => {
  it('asks for the active account’s search window, titled search/lain, and succeeds', async () => {
    const { context, dispatchWindows } = stubContext();

    const outcome = await command.run('lain', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'open', ref: LAIN, title: 'search/lain' });
  });

  it('searches the trimmed query verbatim', async () => {
    const { context, dispatchWindows } = stubContext();

    await expect(command.run('  Is anyone there?  ', context)).resolves.toStrictEqual({ ok: true });

    expect(onlyAsk(dispatchWindows)).toStrictEqual({
      type: 'open',
      ref: { kind: 'search', accountKey: ACCOUNT.key, target: 'Is anyone there?' },
      title: 'search/Is anyone there?',
    });
  });

  it('titles the window with the query cut off at twenty characters', async () => {
    const { context, dispatchWindows } = stubContext();

    await expect(command.run(LONG_QUERY, context)).resolves.toStrictEqual({ ok: true });

    expect(onlyAsk(dispatchWindows)).toStrictEqual({
      type: 'open',
      ref: { kind: 'search', accountKey: ACCOUNT.key, target: LONG_QUERY },
      title: `search/${LONG_QUERY.slice(0, 20)}`,
    });
  });

  it('opens the window the list then shows as the active one', async () => {
    const { context, dispatchWindows } = stubContext();

    await command.run('lain', context);

    const opened = windowsReducer(context.windows, onlyAsk(dispatchWindows));

    expect(opened.activeId).toBe(windowId(LAIN));
    expect(opened.windows.at(-1)?.title).toBe('search/lain');
  });

  it('searches one query twice into the one window the list already shows', async () => {
    const { context, dispatchWindows } = stubContext();

    await command.run('  lain ', context);
    const asked = windowsReducer(context.windows, onlyAsk(dispatchWindows));
    const again = windowsReducer(asked, onlyAsk(dispatchWindows));

    expect(again.windows).toHaveLength(2);
    expect(again.windows.at(1)?.id).toBe(windowId(LAIN));
  });

  it('refuses an empty query with the usage and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext();

    for (const args of ['', '   ', '\t ']) {
      await expect(command.run(args, context)).resolves.toStrictEqual({
        ok: false,
        message: 'Usage: /search <query>',
      });
    }

    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses with nothing signed in and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext(false);

    const outcome = await command.run('lain', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('is run by /s and shows its name in usage', () => {
    expect(command.aliases).toStrictEqual(['s']);
    expect(command.usage).toBe('/search <query>');
  });
});
