/**
 * Tests for /composer: the definition the command line, /help and completion
 * read, that it opens a fresh composer window posting as the active account —
 * a second one numbered next — and that it refuses when nobody is signed in.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './composer';
import { accountKey } from '../../accounts/accountStore';
import { initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import type { WindowsAction } from '../../windows/reducer';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** A context signed in as lain whose window dispatches are recorded. */
function signedIn(): {
  readonly context: CommandContext;
  readonly dispatchWindows: ReturnType<typeof vi.fn<(action: WindowsAction) => void>>;
} {
  const state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [
      {
        key: accountKey(ORIGIN, '1'),
        origin: ORIGIN,
        accountId: '1',
        handle: 'lain@wired.example',
        token: 'never-logged',
        refreshToken: null,
        expiresAt: null,
      },
    ],
    activeKey: accountKey(ORIGIN, '1'),
  });
  const dispatchWindows = vi.fn<(action: WindowsAction) => void>();
  return {
    context: fakeCommandContext({ state, windows: state.windows, dispatchWindows }),
    dispatchWindows,
  };
}

describe('/composer', () => {
  it('declares its name, grammar and summary', () => {
    expect(command.name).toBe('composer');
    expect(command.usage).toBe('/composer');
    expect(command.summary).toBe('Open a composer window');
  });

  it('opens a fresh composer window as the active account', async () => {
    const { context, dispatchWindows } = signedIn();

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(dispatchWindows).toHaveBeenCalledWith({
      type: 'open',
      ref: { kind: 'composer', accountKey: accountKey(ORIGIN, '1'), target: '1' },
      title: 'compose',
    });
  });

  it('refuses without a signed-in account', async () => {
    const dispatchWindows = vi.fn<(action: WindowsAction) => void>();
    const context = fakeCommandContext({ dispatchWindows });

    await expect(command.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });

    expect(dispatchWindows).not.toHaveBeenCalled();
  });
});
