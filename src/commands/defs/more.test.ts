/**
 * Tests for /more: it asks the active window's buffer for one older page and
 * reports ok, whatever arguments it was handed, and a window whose history is
 * exhausted prints that instead of asking — the ask is the only thing this
 * command does, the window's own loader does the fetching.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './more';
import type { StoredAccount } from '../../accounts/accountStore';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window is the active one. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };
const HOME_ID = windowId(HOME);

/** lain's open home window, its timeline shown; {@link exhausted} ends the history. */
function homeState(exhausted: boolean): AppState {
  const signed = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  return appReducer(opened, {
    type: 'load',
    windowId: HOME_ID,
    load: 'loaded',
    olderCursor: { max_id: 'a' },
    exhausted,
  });
}

/** The command over a home window ending {@link exhausted}, recording what it does. */
function stubbed(exhausted: boolean): {
  readonly context: CommandContext;
  readonly dispatch: Mock<CommandContext['dispatch']>;
  readonly print: Mock<CommandContext['print']>;
} {
  const dispatch: Mock<CommandContext['dispatch']> = vi.fn();
  const print: Mock<CommandContext['print']> = vi.fn();
  const state = homeState(exhausted);
  return {
    context: fakeCommandContext({ state, windows: state.windows, dispatch, print }),
    dispatch,
    print,
  };
}

describe('/more', () => {
  it('asks the active window for its older page', async () => {
    const { context, dispatch, print } = stubbed(false);

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'requestOlder', windowId: HOME_ID });
    expect(print).not.toHaveBeenCalled();
  });

  it('ignores its arguments and still asks once', async () => {
    const { context, dispatch } = stubbed(false);

    const outcome = await command.run('ten pages', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('prints that there is nothing older and asks for nothing', async () => {
    const { context, dispatch, print } = stubbed(true);

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledWith('No older posts');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('declares the documented navigation key and alias', () => {
    expect(command.name).toBe('more');
    expect(command.aliases).toStrictEqual(['older']);
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'm', args: '' }]);
  });
});
