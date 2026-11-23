/**
 * Tests for /tag (aliases /join and /t): with an account signed in a valid
 * hashtag — with or without its `#`, in any case — asks the window list for
 * that account's hashtag window, targeted and titled with the lowercased
 * name, and reports success; the window the action opens is the active one,
 * and joining the same tag again finds that same window. Anything that is not
 * a hashtag is refused by name and asks for nothing, and with nobody signed
 * in even a good tag only says to log in.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './tag';
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

/** The #lain view of {@link ACCOUNT}, as the window list names it. */
const LAIN = { kind: 'hashtag', accountKey: ACCOUNT.key, target: 'lain' } as const;

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
    throw new Error('/tag asked for no window');
  }
  return call[0];
}

/** Run {@link args} and report the ask the command made for it. */
async function askFor(args: string): Promise<WindowsAction> {
  const { context, dispatchWindows } = stubContext();

  await expect(command.run(args, context)).resolves.toStrictEqual({ ok: true });

  return onlyAsk(dispatchWindows);
}

describe('/tag', () => {
  it('asks for the active account’s #lain window, titled #lain, and succeeds', async () => {
    const { context, dispatchWindows } = stubContext();

    const outcome = await command.run('#Lain', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchWindows).toHaveBeenCalledTimes(1);
    expect(dispatchWindows).toHaveBeenCalledWith({ type: 'open', ref: LAIN, title: '#lain' });
  });

  it('joins the same window with or without the hash and in any case', async () => {
    const { context, dispatchWindows } = stubContext();

    await expect(command.run('  LAIN ', context)).resolves.toStrictEqual({ ok: true });

    expect(onlyAsk(dispatchWindows)).toStrictEqual({ type: 'open', ref: LAIN, title: '#lain' });
  });

  it('opens the window the list then shows as the active one', async () => {
    const { context, dispatchWindows } = stubContext();

    await command.run('#lain', context);

    const opened = windowsReducer(context.windows, onlyAsk(dispatchWindows));

    expect(opened.activeId).toBe(windowId(LAIN));
    expect(opened.windows.at(-1)?.title).toBe('#lain');
  });

  it('joins a hashtag twice into the one window the list already shows', async () => {
    const { context, dispatchWindows } = stubContext();

    await command.run('#Lain', context);
    const asked = windowsReducer(context.windows, onlyAsk(dispatchWindows));
    const again = windowsReducer(asked, onlyAsk(dispatchWindows));

    expect(again.windows).toHaveLength(2);
    expect(again.windows.at(1)?.id).toBe(windowId(LAIN));
  });

  it('accepts letters of any script, digits and underscores', async () => {
    await expect(askFor('#Ümlaut_2')).resolves.toStrictEqual({
      type: 'open',
      ref: { kind: 'hashtag', accountKey: ACCOUNT.key, target: 'ümlaut_2' },
      title: '#ümlaut_2',
    });
  });

  it('refuses an argument that is not a hashtag and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext();

    for (const args of ['', '#', '##lain', 'not a tag', 'foo-bar', 'a.b']) {
      await expect(command.run(args, context)).resolves.toStrictEqual({
        ok: false,
        message: `Not a hashtag: ${args.trim()}`,
      });
    }

    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses with nothing signed in and asks for no window', async () => {
    const { context, dispatchWindows } = stubContext(false);

    const outcome = await command.run('#lain', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(dispatchWindows).not.toHaveBeenCalled();
  });

  it('is joined by /join and /t and shows its name in usage', () => {
    expect(command.aliases).toStrictEqual(['join', 't']);
    expect(command.usage).toBe('/tag <name>');
  });
});
